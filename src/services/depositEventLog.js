import { buildApiUrl } from "./apiBase.js";

// Bitácora de eventos de depósitos (línea base de horas-hombre).
//
// Los eventos del navegador (abrir/cerrar el detalle, tiempo visible y
// activo, acciones como "comprobar duplicados" o "SQL") se encolan acá y se
// envían en lotes a POST /api/v1/deposit-events. Los eventos de negocio
// (tomar, liberar, confirmar, rechazar, revertir, corregir) los registra el
// backend en sus propios endpoints, con la hora del servidor.
//
// La cola se guarda en localStorage para no perder eventos si se recarga la
// página o se corta la red; se reintenta en el siguiente envío. Nunca
// interrumpe al usuario: si el backend todavía no tiene el endpoint, los
// eventos se descartan en silencio.

const ENDPOINT = "/api/v1/deposit-events";
const SESSION_KEY = "control-depositos-auth-session";
const QUEUE_KEY = "confirmo-deposit-events-queue";
const MAX_QUEUE = 500;
const BATCH_SIZE = 100;
const FLUSH_DELAY_MS = 15000;

let queue = loadQueue();
let flushTimer = null;
let flushing = false;
let endpointMissing = false;

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue() {
  try {
    if (queue.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage lleno o no disponible: la cola vive solo en memoria.
  }
}

function getAccessToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw)?.access_token || null : null;
  } catch {
    return null;
  }
}

export function newEventSessionId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // sin crypto.randomUUID (contexto no seguro): se arma un v4 a mano.
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function scheduleFlush() {
  if (flushTimer || endpointMissing) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushDepositEvents();
  }, FLUSH_DELAY_MS);
}

// Canal desde el que se generó el evento, para separar los flujos en el
// análisis de horas-hombre:
//   web                   -> portal en una pestaña normal
//   extension_portal      -> PortalPanelExtension (portal en vivo dentro del side panel)
//   extension_empaquetada -> copia compilada del fronted cargada como extensión
//   appextension          -> panel lateral de validación (llega reenviado, ver abajo)
function detectCanal() {
  try {
    if (window.__APP_UI_MODE__ === "extension") {
      if (window.location.protocol === "chrome-extension:" || window.location.protocol === "moz-extension:") {
        return "extension_empaquetada";
      }
      return window.top !== window.self ? "extension_portal" : "web";
    }
  } catch {
    // window.top inaccesible: se asume embebido.
    return "extension_portal";
  }
  return "web";
}
const CANAL = typeof window !== "undefined" ? detectCanal() : "web";

export function logDepositEvent(depositId, evento, { sesionId = null, metadata = null, ocurridoEn = null } = {}) {
  if (!depositId || !evento || endpointMissing) return;
  queue.push({
    depositId: String(depositId),
    evento,
    sesionId,
    ocurridoEn: ocurridoEn || new Date().toISOString(),
    metadata: { canal: CANAL, ...(metadata || {}) },
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
  saveQueue();
  if (queue.length >= BATCH_SIZE) void flushDepositEvents();
  else scheduleFlush();
}

export async function flushDepositEvents({ keepalive = false } = {}) {
  if (flushing || queue.length === 0 || endpointMissing) return;
  const token = getAccessToken();
  if (!token) return; // sin sesión: se envía cuando vuelva a haber una

  flushing = true;
  const batch = queue.slice(0, BATCH_SIZE);
  try {
    const response = await fetch(buildApiUrl(ENDPOINT), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: batch }),
      keepalive,
    });

    if (response.ok || response.status === 400 || response.status === 403) {
      // OK, o lote inválido / sin permiso: no tiene sentido reintentarlo.
      queue = queue.slice(batch.length);
      saveQueue();
    } else if (response.status === 404) {
      // El backend aún no tiene la bitácora desplegada: se apaga hasta
      // recargar la página para no acumular ni insistir.
      endpointMissing = true;
      queue = [];
      saveQueue();
    }
    // 401 / 5xx: se deja en cola y se reintenta en el próximo envío.
  } catch {
    // Sin red: se reintenta más tarde.
  } finally {
    flushing = false;
    if (queue.length > 0 && !endpointMissing) scheduleFlush();
  }
}

// Al ocultar la pestaña o salir de la página se envía lo pendiente
// (keepalive permite que el request sobreviva al cierre).
if (typeof window !== "undefined") {
  const flushNow = () => void flushDepositEvents({ keepalive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  window.addEventListener("pagehide", flushNow);
  window.addEventListener("online", () => void flushDepositEvents());
  if (queue.length > 0) scheduleFlush();

  // Eventos del panel lateral de AppExtension: el panel no tiene sesión
  // propia, así que su content-script los reenvía a esta página (que sí la
  // tiene) y acá se encolan como cualquier otro, con canal "appextension".
  // Se responde con un acuse para que la extensión los saque de su cola.
  window.addEventListener("confirmo:log-deposit-events", (event) => {
    const detail = event?.detail || {};
    const events = Array.isArray(detail.events) ? detail.events : [];
    events.forEach((e) => {
      if (!e?.depositId || !e?.evento) return;
      logDepositEvent(e.depositId, e.evento, {
        sesionId: e.sesionId || null,
        ocurridoEn: e.ocurridoEn || null,
        metadata: { ...(e.metadata || {}), canal: "appextension" },
      });
    });
    try {
      window.dispatchEvent(
        new CustomEvent("confirmo:log-deposit-events-ack", {
          detail: { requestId: detail.requestId, accepted: !endpointMissing },
        }),
      );
    } catch {
      // sin CustomEvent: la extensión reintentará más tarde.
    }
  });
}
