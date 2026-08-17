import { apiGet } from "../../../services/backendApi.js";

// ---------------------------------------------------------------------------
// Reportes — dominio en Confirmo.Api (ver Endpoints/ReportesEndpoints.cs).
// Solo finanzas/admin pueden verlos.
// ---------------------------------------------------------------------------

const REPORTES_BASE = "/v1/reportes";

export async function fetchReportesSummary(period) {
  return apiGet(`${REPORTES_BASE}/summary?period=${encodeURIComponent(period)}`);
}

export async function fetchReportesTendencia(trendPeriod) {
  return apiGet(`${REPORTES_BASE}/tendencia?trendPeriod=${encodeURIComponent(trendPeriod)}`);
}
