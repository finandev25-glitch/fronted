import { useCallback, useRef, useState } from "react";
import { createSupportRequest } from "../api/depositsApi.js";

const WORKLOAD_ALERT_THRESHOLD = 3;
const WORKLOAD_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export function useDepositAlerts({ currentUserRef, pendingWorkloadCount }) {
  const [workloadAlarmActive, setWorkloadAlarmActive] = useState(false);
  const [replacementRequestState, setReplacementRequestState] = useState({
    isSending: false,
    lastRequestedAt: null,
    lastResult: null,
  });
  const notificationPermissionPromiseRef = useRef(null);
  const workloadAlarmRef = useRef({
    lastTriggeredAt: 0,
    lastCount: 0,
  });

  const ensureNotificationPermission = useCallback(async () => {
    void notificationPermissionPromiseRef;
    return "disabled";
  }, []);

  const getNotificationIconUrl = useCallback(() => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#2563eb"/>
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="28" fill="url(#g)"/>
        <path d="M24 50.5 64 33l40 17.5v10H24v-10Z" fill="#f8fafc"/>
        <rect x="28" y="60" width="72" height="8" rx="4" fill="#e2e8f0"/>
        <rect x="31" y="70" width="10" height="30" rx="3" fill="#f8fafc"/>
        <rect x="49" y="70" width="10" height="30" rx="3" fill="#f8fafc"/>
        <rect x="69" y="70" width="10" height="30" rx="3" fill="#f8fafc"/>
        <rect x="87" y="70" width="10" height="30" rx="3" fill="#f8fafc"/>
        <rect x="24" y="100" width="80" height="8" rx="4" fill="#e2e8f0"/>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const playAlarmTone = useCallback(async () => {
    if (typeof window === "undefined") return false;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    try {
      const audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.25);

      gainNode.gain.setValueAtTime(0.14, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.28);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
      oscillator.onended = () => {
        audioContext.close().catch(() => {});
      };

      return true;
    } catch (error) {
      console.warn("No se pudo reproducir el tono de alarma:", error.message);
      return false;
    }
  }, []);

  const vibrateAlarm = useCallback(() => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return false;
    }

    navigator.vibrate([220, 80, 220, 80, 320]);
    return true;
  }, []);

  const showNativeAlert = useCallback(
    async ({ title, body, tag, requireInteraction = true, requestPermission = false }) => {
      void title;
      void body;
      void tag;
      void requireInteraction;
      void requestPermission;
      void ensureNotificationPermission;
      void getNotificationIconUrl;
      return false;
    },
    [ensureNotificationPermission, getNotificationIconUrl]
  );

  const showPendingDepositNotification = useCallback(
    async (deposit) => {
      void deposit;
      void showNativeAlert;
      return false;
    },
    [showNativeAlert]
  );

  const createSupportRequestOnBackend = useCallback(
    async ({ reason = "", source = "web" } = {}) => {
      const user = currentUserRef.current;
      const userName = user?.nombre || "Usuario";
      const userRole = user?.user_rol || "N/A";
      const pendingCount = pendingWorkloadCount;
      const finalReason = reason.trim() || "Necesita apoyo temporal por ausencia.";

      console.log("[support-requests] creating", {
        source,
        pendingCount,
        requestedBy: userName,
        requestedByRole: userRole,
        reason: finalReason,
      });

      const response = await createSupportRequest({
        requested_by_id: user?.id || null,
        requested_by_name: userName,
        requested_by_role: userRole,
        reason: finalReason,
        pending_count: pendingCount,
        status: "pendiente",
        source,
      });

      return {
        sent: true,
        data: response?.data || null,
        message: finalReason,
      };
    },
    [currentUserRef, pendingWorkloadCount]
  );

  const triggerWorkloadAlarm = useCallback(async () => {
    const pendingCount = pendingWorkloadCount;

    if (pendingCount < WORKLOAD_ALERT_THRESHOLD) {
      setWorkloadAlarmActive(false);
      return false;
    }

    const now = Date.now();
    const isWithinCooldown = now - workloadAlarmRef.current.lastTriggeredAt < WORKLOAD_ALERT_COOLDOWN_MS;
    const sameCount = workloadAlarmRef.current.lastCount === pendingCount;

    setWorkloadAlarmActive(true);

    if (isWithinCooldown && sameCount) {
      return false;
    }

    workloadAlarmRef.current = {
      lastTriggeredAt: now,
      lastCount: pendingCount,
    };

    await Promise.allSettled([playAlarmTone()]);
    vibrateAlarm();

    return true;
  }, [pendingWorkloadCount, playAlarmTone, vibrateAlarm]);

  const requestReplacementHelp = useCallback(
    async ({ reason = "" } = {}) => {
      console.log("[support-requests] manual help clicked", { reason });
      setReplacementRequestState((prev) => ({
        ...prev,
        isSending: true,
      }));

      try {
        await Promise.allSettled([playAlarmTone()]);
        vibrateAlarm();

        const supportRequest = await createSupportRequestOnBackend({
          reason,
          source: "manual",
        });

        setReplacementRequestState({
          isSending: false,
          lastRequestedAt: Date.now(),
          lastResult: supportRequest.data,
        });

        return supportRequest;
      } catch (error) {
        setReplacementRequestState((prev) => ({
          ...prev,
          isSending: false,
          lastResult: {
            sent: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },
    [createSupportRequestOnBackend, playAlarmTone, vibrateAlarm]
  );

  return {
    workloadAlarmActive,
    workloadThreshold: WORKLOAD_ALERT_THRESHOLD,
    replacementRequestState,
    triggerWorkloadAlarm,
    requestReplacementHelp,
    showPendingDepositNotification,
  };
}

export default useDepositAlerts;
