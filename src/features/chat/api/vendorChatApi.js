import { apiJson } from "../../deposits/api/depositsApi.js";

// ---------------------------------------------------------------------------
// Chat flotante finanzas <-> vendedor.
// ---------------------------------------------------------------------------

const MASTERS_BASE = "/v1/masters";
const CHAT_BASE = "/v1/chat/vendedores";

// GET /api/v1/masters/profiles?rol=vendedor&activo=true YA EXISTE y ya esta
// protegido para finanzas/admin (record ProfileResponse en camelCase). Se
// mapea a snake_case para ser consistente con el resto del frontend
// (ver depositsApi.js: mapBanco/mapEmpresa/mapSucursal/mapTrabajador).
function mapVendedorProfile(profile) {
  return {
    id: profile.id,
    nombre: profile.fullName || "Vendedor sin nombre",
    telefono: profile.phoneNumber || null,
    email: profile.email || null,
    empresa_id: profile.empresaId || null,
    sucursal_id: profile.sucursalId || null,
    activo: !!profile.activo,
    ultima_conexion: profile.lastLoginAt || null,
    creado_en: profile.createdAt || null,
  };
}

export async function fetchVendedores() {
  const data = await apiJson(`${MASTERS_BASE}/profiles?rol=vendedor&activo=true`);
  return (data || []).map(mapVendedorProfile);
}

// Normaliza un mensaje de chat (ya sea venido del historial via REST o de un
// evento SignalR en vivo) a una forma unica que usa la UI.
export function mapVendorChatMessage(raw, fallbackVendedorId) {
  if (!raw) return null;
  return {
    id: raw.id,
    vendedorId: raw.vendedorId || fallbackVendedorId || null,
    senderType: raw.senderType || "system",
    senderId: raw.senderId || null,
    content: raw.content || "",
    messageType: raw.messageType || "text",
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

/*
 * IMPORTANTE (2026-07): estos dos endpoints TODAVIA NO EXISTEN en el backend
 * real (api-bridge / Confirmo.Api). Se pidieron como cambio pendiente, pero el
 * usuario todavia no los implemento. Se documenta aqui la forma esperada para
 * cuando existan, y se sigue el mismo patron que "unsupportedWrite" en
 * depositsApi.js (linea ~327): se intenta la llamada real, y cualquier error
 * (incluido un 404 por endpoint inexistente) se captura, se avisa en consola,
 * y se re-lanza con una marca `isChatUnavailable = true` para que la UI
 * (VendorChatWidget) muestre un mensaje amigable en vez de romperse o quedar
 * en blanco.
 *
 * GET /api/v1/chat/vendedores/{vendedorId}?before=<ISO date opcional>&limit=50
 *   -> { messages: [{ id, vendedorId, senderType: "vendedor"|"finance"|"system",
 *                      senderId, content, messageType: "text"|"image", createdAt }],
 *        hasMore: boolean }
 *
 * POST /api/v1/chat/vendedores/{vendedorId}  body: { content, messageType? }
 *   -> 200 OK devolviendo el mensaje YA persistido (mismo shape que un item
 *      de "messages" en el GET, con el id real generado por el backend). Es
 *      IMPORTANTE que devuelva el mensaje completo y no un 200 vacio: el
 *      widget lo usa para reemplazar su mensaje optimista por el real y asi
 *      no duplicarlo cuando despues llegue el eco por SignalR (mismo
 *      problema que ya se dio -y se corrigio- en el chat de CONFIRMO).
 *
 * Evento SignalR futuro (mismo Hub que ya usa el panel, hoy usado para el
 * chat de depositos via NotifyPanelChatMessage): "ChatMessage" con payload
 * { message: {...VendedorMessageResponse}, vendedorId, timestamp }.
 */

export async function fetchVendedorChatHistory(vendedorId, { before, limit = 50 } = {}) {
  try {
    const query = new URLSearchParams();
    if (before) query.set("before", before);
    if (limit) query.set("limit", String(limit));
    const queryString = query.toString();

    const data = await apiJson(`${CHAT_BASE}/${vendedorId}${queryString ? `?${queryString}` : ""}`);
    const messages = (data?.messages || [])
      .map((item) => mapVendorChatMessage(item, vendedorId))
      .filter(Boolean);

    return { messages, hasMore: !!data?.hasMore };
  } catch (error) {
    console.warn(
      `fetchVendedorChatHistory(${vendedorId}): el backend no tiene el chat de vendedores implementado todavia.`,
      error?.message || error
    );
    const chatError = new Error(
      error?.message || "El chat de vendedores no esta disponible todavia en el backend."
    );
    chatError.isChatUnavailable = true;
    throw chatError;
  }
}

export async function sendVendedorChatMessage(vendedorId, { content, messageType = "text" } = {}) {
  try {
    return await apiJson(`${CHAT_BASE}/${vendedorId}`, {
      method: "POST",
      body: JSON.stringify({ content, messageType }),
    });
  } catch (error) {
    console.warn(
      `sendVendedorChatMessage(${vendedorId}): el backend no tiene el chat de vendedores implementado todavia.`,
      error?.message || error
    );
    const chatError = new Error(
      error?.message || "El chat de vendedores no esta disponible todavia en el backend."
    );
    chatError.isChatUnavailable = true;
    throw chatError;
  }
}
