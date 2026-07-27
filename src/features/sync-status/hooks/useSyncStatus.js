import { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { AuthContext } from "../../auth/context/AuthContext.jsx";
import { fetchSyncStatus } from "../api/syncStatusApi.js";

// El worker corre cada 5s en condiciones normales (ver bank-sync-worker); con
// 60s de polling alcanza de sobra para detectar una caída sin generar tráfico
// de más ni pedirle demasiado al backend.
const POLL_INTERVAL_MS = 60_000;
const WARNING_AFTER_MS = 2 * 60_000; // 2 min sin correr -> demorado
const CRITICAL_AFTER_MS = 15 * 60_000; // 15 min sin correr -> caído

// Mismo criterio de acceso que VendorChatWidget: esto es informacion interna
// de finanzas/admin, los vendedores usan la app movil y nunca ven este panel.
const FINANCE_ROLES = ["admin", "finanzas"];

function computeRowStatus(ultimaCorridaEn, now) {
  if (!ultimaCorridaEn) return "critical";
  const timestamp = new Date(ultimaCorridaEn).getTime();
  if (Number.isNaN(timestamp)) return "critical";
  const ageMs = now - timestamp;
  if (ageMs > CRITICAL_AFTER_MS) return "critical";
  if (ageMs > WARNING_AFTER_MS) return "warning";
  return "ok";
}

export function useSyncStatus() {
  const { currentUser } = useContext(AuthContext);
  const role = currentUser?.user_rol || currentUser?.rol;
  const enabled = !!currentUser && FINANCE_ROLES.includes(role);

  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    fetchSyncStatus()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) => {
        setError(err?.message || "No se pudo consultar el estado de sincronización.");
      })
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const intervalId = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled, load]);

  // El "now" se recalcula en cada render de este hook (que ocurre al menos
  // una vez por poll), asi que "hace X min" se mantiene razonablemente fresco
  // sin necesitar un setInterval de UI aparte solo para el reloj.
  const rowsWithStatus = useMemo(() => {
    const now = Date.now();
    return rows.map((row) => ({ ...row, status: computeRowStatus(row.ultimaCorridaEn, now) }));
  }, [rows]);

  const overallStatus = useMemo(() => {
    if (error && rowsWithStatus.length === 0) return "critical";
    if (!rowsWithStatus.length) return "unknown";
    if (rowsWithStatus.some((r) => r.status === "critical")) return "critical";
    if (rowsWithStatus.some((r) => r.status === "warning")) return "warning";
    return "ok";
  }, [rowsWithStatus, error]);

  return { enabled, rows: rowsWithStatus, overallStatus, loading, error, refresh: load };
}
