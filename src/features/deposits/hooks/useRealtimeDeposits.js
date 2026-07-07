import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { MOCK_MODE_ENABLED } from "../../../mocks/mockServer.js";
import { logger } from "../../../utils/logger";
import {
  getSignalRHubUrl,
  startDepositSignalRConnection,
  stopDepositSignalRConnection,
} from "../../../services/signalrService.js";

const RETRY_DELAY_MS = 3000;

function hasSignalRConfigured() {
  return Boolean(getSignalRHubUrl());
}

function getLocalAuthToken() {
  try {
    const raw = localStorage.getItem("control-depositos-auth-session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export function useRealtimeDeposits(
  isSupabaseConnected,
  currentUser,
  onInsert,
  onUpdate,
  onDelete,
  queryString,
  onReconnectRefresh
) {
  const [realtimeStatus, setRealtimeStatus] = useState(null);
  const [realtimeErrors, setRealtimeErrors] = useState(0);

  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const queryStringRef = useRef(queryString);
  const onReconnectRefreshRef = useRef(onReconnectRefresh);
  const connectionRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
    queryStringRef.current = queryString;
    onReconnectRefreshRef.current = onReconnectRefresh;
  }, [onDelete, onInsert, onReconnectRefresh, onUpdate, queryString]);

  useEffect(() => {
    let isMounted = true;

    const cleanup = async () => {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;

      if (connectionRef.current) {
        try {
          await stopDepositSignalRConnection();
        } catch (error) {
          logger.error("Error closing SignalR connection:", error.message);
        }
        connectionRef.current = null;
      }
    };

    const startSignalR = async () => {
      if (MOCK_MODE_ENABLED) {
        setRealtimeStatus("DISABLED");
        return false;
      }

      if (!currentUser || !hasSignalRConfigured()) {
        setRealtimeStatus("DISABLED");
        return false;
      }

      const connection = await startDepositSignalRConnection({
        accessTokenFactory: getLocalAuthToken,
        onInsert: (newRecord) => {
          if (!isMounted) return;
          onInsertRef.current?.(newRecord);
        },
        onUpdate: (newRecord, oldRecord) => {
          if (!isMounted) return;

          if (newRecord?.id) {
            logger.log("REALTIME SignalR: update received", { id: newRecord.id });
          }

          onUpdateRef.current?.(newRecord, oldRecord);
        },
        onDelete: (deletedRecord) => {
          if (!isMounted) return;
          const deletedId = deletedRecord?.id || deletedRecord;
          onDeleteRef.current?.(deletedId);
        },
        onStatusChange: (status, error) => {
          if (!isMounted) return;

          setRealtimeStatus(status);

          if (status === "SUBSCRIBED") {
            setRealtimeErrors(0);
            logger.log("REALTIME SignalR subscribed", {
              query: queryStringRef.current || null,
            });
            onReconnectRefreshRef.current?.();
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setRealtimeErrors((prev) => prev + 1);
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = setTimeout(() => {
              void startSignalR();
            }, RETRY_DELAY_MS);
          }

          if (error) {
            logger.error("SignalR realtime status:", error.message || String(error));
          }
        },
        onError: (error) => {
          logger.error("Error starting SignalR connection:", error.message);
        },
      });

      connectionRef.current = connection;
      return !!connection;
    };

    const fallbackToSupabase = async () => {
      if (MOCK_MODE_ENABLED) {
        setRealtimeStatus("DISABLED");
        return;
      }

      if (!isSupabaseConnected || !currentUser || !supabase) {
        setRealtimeStatus("DISABLED");
        return;
      }

      let channel = null;

      const cleanupChannel = () => {
        if (!channel) return;
        try {
          channel.unsubscribe();
        } catch (error) {
          logger.error("Error closing realtime channel:", error.message);
        }
        channel = null;
      };

      const handleRealtimeChange = (payload) => {
        if (!isMounted) return;
        const { eventType, new: newRecord, old: oldRecord } = payload;
        const recordId = newRecord?.id || oldRecord?.id;

        if (eventType === "INSERT") {
          onInsertRef.current?.(newRecord);
        } else if (eventType === "UPDATE") {
          onUpdateRef.current?.(newRecord, oldRecord);
        } else if (eventType === "DELETE") {
          onDeleteRef.current?.(oldRecord?.id || recordId);
        }
      };

      const createChannel = () => {
        cleanupChannel();

        channel = supabase
          .channel(`realtime-depositos-${currentUser.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "depositos" }, handleRealtimeChange)
          .subscribe((status, err) => {
            if (!isMounted) return;
            setRealtimeStatus(status);

            if (status === "SUBSCRIBED") {
              setRealtimeErrors(0);
              return;
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setRealtimeErrors((prev) => prev + 1);
              logger.error("Supabase realtime status:", err?.message || status);
            }
          });
      };

      createChannel();
      setRealtimeStatus("CONNECTING");

      return () => cleanupChannel();
    };

    const run = async () => {
      await cleanup();

      const connected = await startSignalR();
      if (!connected) {
        await fallbackToSupabase();
      }
    };

    void run();

    return () => {
      isMounted = false;
      void cleanup();
    };
  }, [currentUser, isSupabaseConnected]);

  return {
    realtimeStatus,
    realtimeErrors,
  };
}

export default useRealtimeDeposits;
