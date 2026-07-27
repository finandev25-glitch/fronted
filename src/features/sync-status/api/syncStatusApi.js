import { apiGet } from "../../../services/backendApi.js";

// ---------------------------------------------------------------------------
// Estado de sincronización SQL Server -> Cloud SQL (bank-sync-worker).
// GET /api/v1/sync-status ya existe en el backend real (no es un endpoint
// futuro/pendiente, a diferencia de vendorChatApi.js) -- lee directo de las
// tablas de checkpoint que actualiza el worker cada vez que corre (cada 5s
// en condiciones normales):
//   - sync_checkpoints              (mirror de CORTADO1/2 -> movimientos_bancarios)
//   - registros_concar_checkpoints  (mirror de RegistrosConcar1/2 -> registros_concar)
// ---------------------------------------------------------------------------

const TABLE_LABELS = {
  movimientos_bancarios: "Movimientos (CORTADO)",
  registros_concar: "RegistrosConcar",
};

export async function fetchSyncStatus() {
  const rows = await apiGet("/v1/sync-status");
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    tabla: row.tabla,
    tablaLabel: TABLE_LABELS[row.tabla] || row.tabla,
    empresa: row.empresa,
    ultimaCorridaEn: row.ultimaCorridaEn || null,
    ultimoFechaMod: row.ultimoFechaMod || null,
    filasUltimaCorrida: row.filasUltimaCorrida || 0,
  }));
}
