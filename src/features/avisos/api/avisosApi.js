import { apiGet, apiPost, apiPut, apiDelete } from "../../../services/backendApi.js";
import { buildApiUrl } from "../../../services/apiBase.js";

const API_BASE = "/api";
const SESSION_KEY = "control-depositos-auth-session";

function getStoredAccessToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Avisos — dominio nuevo en Confirmo.Api (ver Endpoints/AvisoEndpoints.cs).
// Solo admin puede crear/listar/desactivar (POST /v1/avisos, GET /v1/avisos,
// PUT /v1/avisos/{id}/desactivar). GET /v1/avisos/mios es el que consume
// CONFIRMO (Android), filtrado server-side por el rol del usuario logueado.
// ---------------------------------------------------------------------------

const AVISOS_BASE = "/v1/avisos";

export async function fetchAvisos() {
  const rows = await apiGet(AVISOS_BASE);
  return Array.isArray(rows) ? rows : [];
}

export async function createAviso(payload) {
  return apiPost(AVISOS_BASE, payload);
}

export async function updateAviso(id, payload) {
  return apiPut(`${AVISOS_BASE}/${id}`, payload);
}

// Reactiva el envio de un aviso ya registrado (sin crear uno nuevo).
// programadoPara es opcional (ISO string) — si se omite, el backend lo
// dispara en el proximo ciclo del AvisoDispatchService (~1 min).
export async function reenviarAviso(id, programadoPara) {
  return apiPost(`${AVISOS_BASE}/${id}/reenviar`, { programadoPara: programadoPara || null });
}

export async function desactivarAviso(id) {
  return apiPut(`${AVISOS_BASE}/${id}/desactivar`);
}

// Sube la imagen ANTES de crear/editar el aviso. Devuelve
// { mediaUrl, tipoMedia, galeriaId } — mediaUrl en realidad es el object
// name de GCS (no una URL directa). Cada subida queda tambien guardada en
// la galeria del backend para poder reusarla despues sin volver a subirla.
export async function uploadAvisoMedia(imagenBase64, contentType, nombre) {
  return apiPost(`${AVISOS_BASE}/media`, { imagenBase64, contentType, nombre: nombre || null });
}

// URL estable para <img src>: redirige a una firma de GCS fresca en cada
// visita (mismo patron que buildVoucherImageUrl en depositsApi.js).
export function getAvisoMediaUrl(avisoId) {
  if (!avisoId) return null;
  const token = getStoredAccessToken();
  if (!token) return null;
  return buildApiUrl(`${API_BASE}${AVISOS_BASE}/${avisoId}/media?access_token=${encodeURIComponent(token)}`);
}

// ---------------------------------------------------------------------------
// Galeria de imagenes — todas las imagenes subidas alguna vez para un aviso
// quedan aca, para elegir una existente en vez de volver a subirla.
// ---------------------------------------------------------------------------

export async function fetchGaleriaImagenes() {
  const rows = await apiGet(`${AVISOS_BASE}/galeria`);
  return Array.isArray(rows) ? rows : [];
}

export async function deleteGaleriaImagen(id) {
  return apiDelete(`${AVISOS_BASE}/galeria/${id}`);
}

export function getGaleriaImagenUrl(id) {
  if (!id) return null;
  const token = getStoredAccessToken();
  if (!token) return null;
  return buildApiUrl(`${API_BASE}${AVISOS_BASE}/galeria/${id}/imagen?access_token=${encodeURIComponent(token)}`);
}

// ---------------------------------------------------------------------------
// Plantillas de WhatsApp (Zavu) — ver Endpoints/ZavuPlantillaEndpoints.cs.
// Toda plantilla de Zavu se arma siempre con 2 variables fijas: "1" (nombre
// del destinatario) y "2" (contenido del comunicado) — por eso acá solo se
// elige CUÁL plantilla usar (por código), nunca se arman variables sueltas
// a mano desde este panel.
// ---------------------------------------------------------------------------

const ZAVU_PLANTILLAS_BASE = "/v1/zavu-plantillas";

export async function fetchZavuPlantillas() {
  const rows = await apiGet(ZAVU_PLANTILLAS_BASE);
  return Array.isArray(rows) ? rows : [];
}
