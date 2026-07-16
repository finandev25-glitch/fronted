import { useCallback, useRef, useState } from "react";
import { createSupportRequest } from "../api/depositsApi.js";

const WORKLOAD_ALERT_THRESHOLD = 3;
const WORKLOAD_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

// Notificación de nuevos pendientes: "más de 3" => count > 3. Cooldown corto
// para no repetir la notificación cuando llegan varios depósitos seguidos.
const PENDING_ALERT_THRESHOLD = 3;
const PENDING_ALERT_COOLDOWN_MS = 60 * 1000;

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
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }, []);

  const getNotificationIconUrl = useCallback(() => {
    // Ícono rojo con una campana, para que la notificación se lea urgente.
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
        <rect width="128" height="128" rx="28" fill="#dc2626"/>
        <path d="M64 28c-12 0-21 9-21 21v13l-9 12v4h60v-4l-9-12V49c0-12-9-21-21-21Z" fill="#ffffff"/>
        <circle cx="64" cy="98" r="9" fill="#ffffff"/>
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

    // Chrome BLOQUEA navigator.vibrate hasta que el usuario haya interactuado
    // con la página (y lo registra como error en la consola/extensión). Si aún
    // no hubo interacción, salimos sin llamarlo para no ensuciar el log.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      return false;
    }

    try {
      navigator.vibrate([220, 80, 220, 80, 320]);
    } catch {
      return false;
    }
    return true;
  }, []);

  const showNativeAlert = useCallback(
    ({ title, body, tag, requireInteraction = true }) => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return false;
      }
      // No pedimos permiso aquí (requiere gesto del usuario); solo mostramos
      // si ya fue concedido. El botón "Activar notificaciones" hace la solicitud.
      if (Notification.permission !== "granted") return false;

      try {
        const notification = new Notification(title, {
          body,
          tag,
          renotify: true,
          requireInteraction,
          icon: getNotificationIconUrl(),
          badge: getNotificationIconUrl(),
        });
        notification.onclick = () => {
          try {
            window.focus();
          } catch {
            // Ignorar: algunos navegadores no permiten enfocar desde aquí.
          }
          notification.close();
        };
        return true;
      } catch (error) {
        console.warn("No se pudo mostrar la notificación nativa:", error?.message);
        return false;
      }
    },
    [getNotificationIconUrl]
  );

  const showPendingDepositNotification = useCallback(
    async (deposit) => {
      void deposit;
      void showNativeAlert;
      return false;
    },
    [showNativeAlert]
  );

  // Dispara la notificación roja: nativa del SO (si hay permiso) + sonido +
  // vibración. Visible aunque el navegador esté minimizado o el usuario esté
  // en otra aplicación (mientras el navegador siga abierto).
  const fireRedNotification = useCallback(
    async ({ title, body, tag }) => {
      const shown = showNativeAlert({ title, body, tag, requireInteraction: true });
      await Promise.allSettled([playAlarmTone()]);
      vibrateAlarm();
      return shown;
    },
    [showNativeAlert, playAlarmTone, vibrateAlarm]
  );

  // Notifica SOLO cuando se AÑADE un nuevo pendiente (el conteo aumenta) y el
  // total de la columna "Pendiente" de hoy supera 3. Es decir: una notificación
  // por cada card nuevo mientras haya más de 3 — no se repite "a cada rato".
  // lastCount = null en la primera evaluación (carga inicial) para NO notificar
  // por los que ya estaban.
  const pendingAlertRef = useRef({ lastCount: null, lastNotifiedAt: 0 });
  const notifyNewPendingIfNeeded = useCallback(
    async (count) => {
      const state = pendingAlertRef.current;
      const prevCount = state.lastCount;
      state.lastCount = count;

      // Carga inicial: registrar el conteo sin notificar.
      if (prevCount === null) return false;

      // Solo si AUMENTÓ (se añadió un card) y el total supera 3.
      if (count <= prevCount || count <= PENDING_ALERT_THRESHOLD) return false;

      // Anti-doble-disparo por renders rápidos (no es un cooldown por tiempo).
      const now = Date.now();
      if (now - state.lastNotifiedAt < 1500) return false;
      state.lastNotifiedAt = now;

      return fireRedNotification({
        title: "🔴 Nuevo depósito pendiente",
        body: `Hay ${count} depósitos pendientes de hoy por validar.`,
        tag: "nuevo-pendiente-hoy",
      });
    },
    [fireRedNotification]
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
    notifyNewPendingIfNeeded,
    ensureNotificationPermission,
  };
}

export default useDepositAlerts;
