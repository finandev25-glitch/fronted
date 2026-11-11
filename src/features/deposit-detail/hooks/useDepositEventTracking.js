import { useCallback, useEffect, useRef } from "react";
import { logDepositEvent, newEventSessionId } from "../../../services/depositEventLog.js";

// Mide cuánto tiempo pasa un analista con el detalle de un depósito abierto
// (línea base de horas-hombre). Por cada apertura del detalle genera una
// "sesión" con:
//   - detalle_abierto  (estado al abrir, presentación)
//   - accion           (comprobar_duplicados, consulta_sql, panel_lateral, chat...)
//   - detalle_cerrado  (total_ms, visible_ms, activo_ms, estado al cerrar)
//
// activo_ms = tiempo con la pestaña visible Y con interacción (mouse,
// teclado, scroll) en los últimos 60 s. Es la medida más cercana al
// trabajo real: descuenta pestañas en segundo plano y pausas largas.

const IDLE_THRESHOLD_MS = 60000;
const TICK_MS = 1000;

export function useDepositEventTracking(deposit, { presentacion = "default" } = {}) {
  const depositId = deposit?.id;
  const estadoRef = useRef(deposit?.estado);
  estadoRef.current = deposit?.estado;
  const sessionRef = useRef(null);

  useEffect(() => {
    if (!depositId) return undefined;

    const sesionId = newEventSessionId();
    const startedAt = Date.now();
    let visibleMs = 0;
    let activeMs = 0;
    let lastInteraction = Date.now();
    let closed = false;
    sessionRef.current = { sesionId, depositId };

    logDepositEvent(depositId, "detalle_abierto", {
      sesionId,
      metadata: { estado: estadoRef.current || null, presentacion },
    });

    const markInteraction = () => {
      lastInteraction = Date.now();
    };
    const interactionEvents = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"];
    interactionEvents.forEach((ev) => window.addEventListener(ev, markInteraction, { passive: true }));

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleMs += TICK_MS;
      if (Date.now() - lastInteraction < IDLE_THRESHOLD_MS) activeMs += TICK_MS;
    }, TICK_MS);

    const close = (porSalida) => {
      if (closed) return;
      closed = true;
      logDepositEvent(depositId, "detalle_cerrado", {
        sesionId,
        metadata: {
          total_ms: Date.now() - startedAt,
          visible_ms: visibleMs,
          activo_ms: activeMs,
          estado: estadoRef.current || null,
          presentacion,
          ...(porSalida ? { por_salida: true } : {}),
        },
      });
    };
    // Si se cierra la pestaña/recarga con el detalle abierto, igual se
    // registra el cierre (la cola se envía con keepalive en pagehide).
    const onPageHide = () => close(true);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(tick);
      interactionEvents.forEach((ev) => window.removeEventListener(ev, markInteraction));
      window.removeEventListener("pagehide", onPageHide);
      close(false);
      sessionRef.current = null;
    };
  }, [depositId, presentacion]);

  const trackAction = useCallback((accion, metadata = null) => {
    const s = sessionRef.current;
    if (!s) return;
    logDepositEvent(s.depositId, "accion", {
      sesionId: s.sesionId,
      metadata: { accion, ...(metadata || {}) },
    });
  }, []);

  return { trackAction };
}

export default useDepositEventTracking;
