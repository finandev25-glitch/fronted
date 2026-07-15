import { useEffect, useRef, useState } from "react";

// Cuanto dura el resaltado visual de una card tras un evento realtime.
// Debe coincidir con la duracion de los keyframes rt-flash-* en index.css.
const HIGHLIGHT_MS = 1400;

/**
 * Mantiene un mapa { [depositId]: tipoEvento } de las cards que acaban de
 * recibir un cambio via SignalR, para resaltarlas temporalmente en el Kanban.
 *
 * `realtimeActivity` viene de useDepositRecords y cambia de identidad en cada
 * evento (trae `at: Date.now()`), asi que el efecto se dispara aunque el
 * depositId sea el mismo dos veces seguidas.
 *
 * @param {{ type?: string, depositId?: string|number|null, at?: number } | null} realtimeActivity
 * @returns {Record<string, string>} mapa id -> tipo ("update" | "insert" | ...)
 */
export function useRealtimeHighlights(realtimeActivity) {
  const [highlights, setHighlights] = useState({});
  const timersRef = useRef({});

  useEffect(() => {
    const id = realtimeActivity?.depositId;
    const type = realtimeActivity?.type;
    // Los inserts llegan con depositId=null (la lista se refresca entera),
    // asi que solo resaltamos eventos que apuntan a una card concreta.
    if (id == null || !type) return;

    const key = String(id);
    setHighlights((prev) => ({ ...prev, [key]: type }));

    clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(() => {
      setHighlights((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      delete timersRef.current[key];
    }, HIGHLIGHT_MS);
  }, [realtimeActivity]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return highlights;
}

export default useRealtimeHighlights;
