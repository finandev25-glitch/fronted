/**
 * useSystemHealth.js
 *
 * Estado de salud del sistema para el indicador tipo "monitor de signos
 * vitales" del Kanban (ver SystemPulseMonitor.jsx). Combina tres señales:
 *
 *  1. Internet del equipo  -> eventos online/offline del navegador.
 *  2. Servidor (api-bridge) -> GET /health cada HEALTH_INTERVAL_MS, midiendo
 *     el tiempo de respuesta. /health es público (sin token) y ya existe en
 *     api-bridge (Program.cs: app.MapGet("/health", ...)).
 *  3. Tiempo real (SignalR) -> realtimeStatus que ya calcula
 *     useRealtimeDeposits.js y llega acá por props.
 *  4. Imágenes (Google Cloud Storage) -> las fotos de los vouchers no vienen
 *     del api-bridge: /deposits/{id}/image redirige a storage.googleapis.com.
 *     Algunas redes corporativas bloquean ese dominio (pasó con la red de la
 *     oficina: todo funcionaba menos las imágenes). Se prueba con un fetch
 *     "no-cors" a storage.googleapis.com: si la red lo bloquea, el fetch
 *     falla con error de red; si llega, resuelve (respuesta opaca, no
 *     importa el contenido). No usa token ni depende de ningún depósito.
 *
 * Devuelve un estado único:
 *   "ok"        -> todo responde.
 *   "degraded"  -> conectando/reconectando, servidor lento o falló 1 vez.
 *   "down"      -> sin internet o el servidor falló 2+ veces seguidas.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../../../services/apiBase.js";

const HEALTH_INTERVAL_MS = 30000;
const HEALTH_TIMEOUT_MS = 5000;
const SLOW_RESPONSE_MS = 3000;
const FAILURES_FOR_DOWN = 2;
const STORAGE_PROBE_URL = "https://storage.googleapis.com/";

// Estados de useRealtimeDeposits/signalrService.js que significan "el tiempo
// real no está entregando actualizaciones ahora mismo".
const REALTIME_NOT_READY = new Set([
  "CONNECTING",
  "RECONNECTING",
  "CHANNEL_ERROR",
  "TIMED_OUT",
  "CLOSED",
  "DISCONNECTED",
]);

const REALTIME_LABELS = {
  SUBSCRIBED: "conectado",
  CONNECTING: "conectando…",
  RECONNECTING: "reconectando…",
  CHANNEL_ERROR: "con error",
  TIMED_OUT: "sin respuesta",
  CLOSED: "cerrado",
  DISCONNECTED: "desconectado",
  DISABLED: "no disponible",
};

export function useSystemHealth({ realtimeStatus = null, enabled = true } = {}) {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [api, setApi] = useState({
    ok: null, // null = todavía no se chequeó
    latencyMs: null,
    failures: 0,
    lastCheckAt: null,
  });
  // null = todavía no se probó; true = Google Storage alcanzable; false = bloqueado.
  const [imagesOk, setImagesOk] = useState(null);
  const inFlightRef = useRef(false);

  const checkImages = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      await fetch(STORAGE_PROBE_URL, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      setImagesOk(true);
    } catch {
      setImagesOk(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    if (!enabled || inFlightRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    inFlightRef.current = true;
    void checkImages();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const startedAt = performance.now();

    try {
      const response = await fetch(buildApiUrl("/health"), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latencyMs = Math.round(performance.now() - startedAt);
      setApi({ ok: true, latencyMs, failures: 0, lastCheckAt: new Date() });
    } catch {
      setApi((prev) => ({
        ok: false,
        latencyMs: null,
        failures: prev.failures + 1,
        lastCheckAt: new Date(),
      }));
    } finally {
      clearTimeout(timeoutId);
      inFlightRef.current = false;
    }
  }, [enabled, checkImages]);

  // Internet del navegador + chequeo inmediato al recuperar conexión o al
  // volver a la pestaña (si estuvo en segundo plano, el dato puede ser viejo).
  useEffect(() => {
    if (!enabled) return undefined;

    const handleOnline = () => {
      setOnline(true);
      void checkHealth();
    };
    const handleOffline = () => setOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkHealth();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, checkHealth]);

  // Chequeo periódico del servidor.
  useEffect(() => {
    if (!enabled) return undefined;
    void checkHealth();
    const intervalId = setInterval(() => void checkHealth(), HEALTH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled, checkHealth]);

  // ---- Estado combinado ----
  let status = "ok";
  let reason = "Todo en orden";
  // Qué originó un estado "degraded" puntual que el componente quiera
  // distinguir (por ahora solo "images").
  let cause = null;

  if (!online) {
    status = "down";
    reason = "Sin conexión a internet";
  } else if (api.failures >= FAILURES_FOR_DOWN) {
    status = "down";
    reason = "El servidor no responde";
  } else if (api.ok === null) {
    status = "degraded";
    reason = "Verificando conexión…";
  } else if (api.failures > 0) {
    status = "degraded";
    reason = "Respuesta intermitente del servidor";
  } else if (REALTIME_NOT_READY.has(realtimeStatus)) {
    status = "degraded";
    reason = "Reconectando actualizaciones en tiempo real…";
  } else if (imagesOk === false) {
    status = "degraded";
    cause = "images";
    reason = "Las imágenes no cargan: la red bloquea Google Storage";
  } else if (api.latencyMs != null && api.latencyMs > SLOW_RESPONSE_MS) {
    status = "degraded";
    reason = "El servidor está respondiendo lento";
  }

  return {
    status,
    reason,
    cause,
    online,
    imagesOk,
    imagesBlocked: online && api.ok === true && imagesOk === false,
    latencyMs: api.latencyMs,
    serverOk: api.ok,
    lastCheckAt: api.lastCheckAt,
    realtimeLabel: REALTIME_LABELS[realtimeStatus] || "conectando…",
    recheck: checkHealth,
  };
}

export default useSystemHealth;
