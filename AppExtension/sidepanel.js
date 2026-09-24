const QUEUE_STORAGE_KEY = "voucher_queue_state";

// Ícono de lupa para los botones de búsqueda (Importe / Número de operación)
// -- SVG en vez del emoji 🔍 porque este último se ve borroso/inconsistente
// entre plataformas a tamaños chicos; el trazo del SVG se ve nítido.
const SEARCH_ICON_SVG = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2.4"/><path d="M17 17L13.4 13.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

// Ícono de calendario con un check para el botón "Usar fecha de hoy" (ver
// .queue-date-today-btn más abajo).
const TODAY_ICON_SVG = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="14" height="13" rx="1.6" stroke="currentColor" stroke-width="2"/><path d="M3 8H17" stroke="currentColor" stroke-width="2"/><path d="M6.5 12.3L8.3 14L13 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// YYYY-MM-DD en horario local (no UTC) -- coincide con lo que espera un
// <input type="date">. new Date().toISOString() usaría UTC y podía dar el
// día siguiente/anterior según la hora y la zona horaria del usuario.
function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const elements = {
  voucherTitle: document.getElementById("voucherTitle"),
  voucherBody: document.getElementById("voucherBody"),
  toast: document.getElementById("toast"),
};

// Mensaje flotante y breve tras "Guardar cambios" (ver .queue-item-attend-btn
// más abajo) -- confirma que la validación pasó y los datos ya estaban
// guardados (se guardan solos en cada blur/change, ver wireEditInput).
let toastHideTimer = null;

const TOAST_CHECK_ICON_SVG = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10.5L8 14.5L16 5.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const TOAST_WARNING_ICON_SVG = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L18 17H2L10 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 8.2V11.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14" r="1" fill="currentColor"/></svg>`;

function hideToast() {
  if (toastHideTimer) clearTimeout(toastHideTimer);
  elements.toast.classList.remove("is-visible");
  toastHideTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 200);
}
elements.toast.addEventListener("click", () => {
  // Solo "error" se queda hasta que lo cierren a mano (ver showToast) --
  // clickear un toast que ya se iba a cerrar solo no rompe nada.
  hideToast();
});

// tone: "success" (verde, default) | "warning" (ámbar, se cierra solo) |
// "error" (rojo, NO se cierra solo -- el usuario lo cierra tocándolo; ver
// findAnexoValidationRule más abajo, primer uso de "error").
function showToast(message, tone = "success") {
  if (toastHideTimer) clearTimeout(toastHideTimer);
  // Restart de la animación de "pop" (@keyframes toast-pop): sacar y volver a
  // poner is-visible en el mismo tick no alcanza para reiniciar una CSS
  // animation ya corriendo, hace falta el reflow forzado (offsetWidth) del
  // medio para que el navegador "olvide" el estado anterior.
  elements.toast.classList.remove("is-visible");
  elements.toast.classList.toggle("tone-warning", tone === "warning");
  elements.toast.classList.toggle("tone-error", tone === "error");
  const icon = tone === "warning" || tone === "error" ? TOAST_WARNING_ICON_SVG : TOAST_CHECK_ICON_SVG;
  const closeHint = tone === "error" ? '<span class="toast-close-hint">Toca para cerrar</span>' : "";
  elements.toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>${closeHint}`;
  elements.toast.hidden = false;
  void elements.toast.offsetWidth;
  elements.toast.classList.add("is-visible");
  if (tone === "error") return;
  // Las advertencias se quedan un poco más -- son más largas y hay que
  // llegar a leerlas, no son solo un "listo".
  const duration = tone === "warning" ? 3800 : 2000;
  toastHideTimer = setTimeout(hideToast, duration);
}

// Anexo termina en "MN" (moneda nacional, Soles) o "ME" (moneda extranjera,
// Dólares) -- si no coincide con la Moneda ya elegida, es casi seguro que
// alguien se equivocó de anexo o de moneda. Se avisa con un toast (no se
// corrige solo, el usuario decide cuál de los dos está mal).
const ANEXO_SUFFIX_TO_MONEDA = { MN: "PEN", ME: "USD" };
const MONEDA_LABEL = { PEN: "Soles (PEN)", USD: "Dólares (USD)" };

function checkAnexoMonedaMismatch(inner, anexoValue) {
  const suffix = String(anexoValue || "").trim().toUpperCase().slice(-2);
  const expectedMoneda = ANEXO_SUFFIX_TO_MONEDA[suffix];
  if (!expectedMoneda) return;

  const monedaEl = inner.querySelector('[data-field="moneda"]');
  const currentMoneda = monedaEl?.value || "";
  if (currentMoneda && currentMoneda !== expectedMoneda) {
    showToast(
      `⚠️ Anexo "${anexoValue}" es de ${MONEDA_LABEL[expectedMoneda]}, pero la moneda elegida es ${MONEDA_LABEL[currentMoneda] || currentMoneda}.`,
      "warning",
    );
  }
}

// ── Verificación OCR (Llama vs. Vision) ──────────────────────────────────
// Copia de src/features/deposits/utils/verificacionOcrHelpers.js -- pinta
// Moneda/Importe/Fecha según deposit.datos_ocr.verificacion (mandado por la
// app web en depositData.verificacionOcr, ver useDepositQueue.js). Shape:
// { monto: {accion, motivo}, moneda: {...}, fecha_deposito: {...} }.
const CLASE_POR_ACCION_OCR = {
  ninguna: "verif-ok",
  revision_manual: "verif-revisar",
  auto_corregido: "verif-auto",
};

function campoVerificacionOcr(verificacionOcr, campo) {
  if (!verificacionOcr) return null;
  return verificacionOcr[campo] || null;
}

function claseSegunAccionOcr(accion) {
  return CLASE_POR_ACCION_OCR[accion] || "";
}

function motivoVisibleOcr(verificacionCampo) {
  if (!verificacionCampo) return "";
  if (verificacionCampo.accion === "ninguna") {
    return verificacionCampo.motivo || "Valor verificado: Llama y OCR coinciden.";
  }
  if (verificacionCampo.accion === "revision_manual") {
    return verificacionCampo.motivo || "Revisar: Llama y OCR obtuvieron valores diferentes.";
  }
  if (verificacionCampo.accion === "auto_corregido") {
    return verificacionCampo.motivo || "Llama no obtuvo el valor; se utilizó el candidato OCR.";
  }
  return "";
}

// ── Validación Anexo/Empresa vs. página del banco ────────────────────────
// Copia de src/features/deposit-detail/data/anexoValidationRules.js -- si el
// Excel (Validacion.xlsx) cambia, hay que actualizar ambas copias a mano.
const ANEXO_VALIDATION_RULES = [
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "YCREDMN", empresaValidar: "J.CH.COMERCIAL S.A.", datoValidar: "Corriente Soles 191-6661277-0-24" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "LCRED ME", empresaValidar: "J.CH.COMERCIAL S.A.", datoValidar: "Corriente Dólares 193-9948591-1-26" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "LCRED MN", empresaValidar: "J.CH.COMERCIAL S.A.", datoValidar: "Corriente Soles 193-9945454-0-29" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "CREDI ME", empresaValidar: "J.CH.COMERCIAL S.A.", datoValidar: "Corriente Dólares 540-0051071-1-23" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "CREDI MN", empresaValidar: "J.CH.COMERCIAL S.A.", datoValidar: "Corriente Soles 540-0051072-0-23" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "RECAU MN", empresaValidar: "J.CH.COMERCIAL S.A.", datoValidar: "Corriente Soles 540-1187644-0-47" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "RECAU ME", empresaValidar: "J.CH.COMERCIAL S.A.", datoValidar: "Corriente Dólares 540-1188858-1-19" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "YCREDMN", empresaValidar: "EVOLUTION CAR SERVICE EIRL", datoValidar: "Corriente Soles 191-6661334-0-00" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "LCRED MN", empresaValidar: "EVOLUTION CAR SERVICE EIRL", datoValidar: "Corriente Soles 193-9951933-0-73" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "LCRED ME", empresaValidar: "EVOLUTION CAR SERVICE EIRL", datoValidar: "Corriente Dólares 193-9953618-1-03" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "CREDI MN", empresaValidar: "EVOLUTION CAR SERVICE EIRL", datoValidar: "Corriente Soles 540-1588073-0-85" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "CREDI ME", empresaValidar: "EVOLUTION CAR SERVICE EIRL", datoValidar: "Corriente Dólares 540-1599931-1-72" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "CONTI ME", empresaValidar: "J CH COMERCIAL SA", datoValidar: "Nº de la Cuenta: 0011-0232-01-00047073 - CUENTA CORRIENTE" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "CONTI MN", empresaValidar: "J CH COMERCIAL SA", datoValidar: "Nº de la Cuenta: 0011-0232-01-00047065 - CUENTA CORRIENTE" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "BBVA MN", empresaValidar: "EVOLUTION CAR SERVICE EIRL", datoValidar: "Nº de la Cuenta: 0011-0409-01-00005410 - CUENTA CORRIENTE" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "BBVA ME", empresaValidar: "EVOLUTION CAR SERVICE EIRL", datoValidar: "Nº de la Cuenta: 0011-0409-01-00005429 - CUENTA CORRIENTE" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "INTER MN", empresaValidar: "J CH COMERCIAL", datoValidar: "Corriente Soles 340-0001256733" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "INTER ME", empresaValidar: "J CH COMERCIAL", datoValidar: "Corriente Dólares 340-0001256732" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "INTER MN", empresaValidar: "EVOLUTION CAR SERVICE", datoValidar: "Corriente Soles 340-3001121616" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "INTER ME", empresaValidar: "EVOLUTION CAR SERVICE", datoValidar: "Corriente Dólares 340-3000998246" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "SCOTI MN", empresaValidar: "J.CH. COMERCIAL S.A.", datoValidar: "Cuenta Corriente CCMN 258-1030020" },
  { empresaSeleccionado: "JCH COMERCIAL SA", anexoSeleccionado: "SCOTI ME", empresaValidar: "J.CH. COMERCIAL S.A.", datoValidar: "Cuenta Corriente CCME 258-1030021" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "SCOTI MN", empresaValidar: "EVOLUTION CAR SERVIC", datoValidar: "Cuenta Corriente CCMN 000-2558512" },
  { empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL", anexoSeleccionado: "SCOTI ME", empresaValidar: "EVOLUTION CAR SERVIC", datoValidar: "Cuenta Corriente CCME 000-5155551" },
];

function normalizeAnexoValidationKey(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function findAnexoValidationRule(empresaNombre, anexo) {
  const empresaKey = normalizeAnexoValidationKey(empresaNombre);
  const anexoKey = normalizeAnexoValidationKey(anexo);
  if (!empresaKey || !anexoKey) return null;
  return (
    ANEXO_VALIDATION_RULES.find(
      (rule) =>
        normalizeAnexoValidationKey(rule.empresaSeleccionado) === empresaKey &&
        normalizeAnexoValidationKey(rule.anexoSeleccionado) === anexoKey,
    ) || null
  );
}

let queueItems = [];

function normalizeVoucherUrl(url) {
  if (!url) return "";

  if (url.includes("drive.google.com/file/d/")) {
    const fileIdMatch = url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch?.[1]) {
      return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
    }
  }

  return url;
}

function resolveDepositDate(data) {
  return data?.fecha_deposito || data?.fechaDeposito || "";
}

function isPdfUrl(url) {
  return String(url || "").toLowerCase().includes(".pdf");
}

function formatAmount(value) {
  if (value === undefined || value === null || value === "") return "-";
  const numericAmount = Number(String(value).replace(/[^0-9,.-]/g, "").replace(",", "."));
  if (Number.isNaN(numericAmount)) {
    return String(value);
  }
  return numericAmount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Temporizador de 4 min del candado ───────────────────────────────────
// Mismo criterio que utils/depositLockHelpers.js del lado de la app: el
// respaldo real vive en el backend (FechaBloqueo/TTL en POST /lock); acá
// solo se muestra la cuenta regresiva usando fechaBloqueo (mandado por
// useDepositQueue.js). No hay manera de llamar a /unlock desde el side
// panel (no tiene sesión propia), así que es solo informativo -- el
// panel principal (fronted) es quien libera proactivamente al llegar a 0.
const LOCK_TTL_MS = 4 * 60 * 1000;

function getLockRemainingMs(data) {
  if (!data?.fechaBloqueo || data.estado !== "procesado") return null;
  const takenAt = new Date(data.fechaBloqueo).getTime();
  if (Number.isNaN(takenAt)) return null;
  return Math.max(0, LOCK_TTL_MS - (Date.now() - takenAt));
}

function formatLockRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildLockBadgeHtml(data) {
  const remaining = getLockRemainingMs(data);
  if (remaining === null) return "";
  return `<span class="queue-item-lock-badge" data-lock-badge data-fecha-bloqueo="${escapeHtml(data.fechaBloqueo)}" data-estado="${escapeHtml(data.estado || "")}">${formatLockRemaining(remaining)}</span>`;
}

// Actualiza todas las cuentas regresivas ya pintadas en el DOM sin esperar a
// un cambio de storage (que solo llega cuando algo cambia de verdad) -- así
// el segundero se mueve solo, igual que en el Kanban.
function updateLockBadges() {
  document.querySelectorAll("[data-lock-badge]").forEach((badge) => {
    const fechaBloqueo = badge.getAttribute("data-fecha-bloqueo");
    const estado = badge.getAttribute("data-estado");
    const remaining = getLockRemainingMs({ fechaBloqueo, estado });
    if (remaining === null) {
      badge.textContent = "";
      return;
    }
    badge.textContent = formatLockRemaining(remaining);
    badge.classList.toggle("is-low", remaining <= 60000);
  });
}

setInterval(updateLockBadges, 1000);

function getSearchPayloadFromDepositData(data) {
  const safeData = data || {};
  // Un solo campo de operación en uso real (numero_operacion, ver
  // buildQueueItemDetailContent) -- numero_operacion_banco es un vestigio
  // que ya no se edita, pero se sigue mandando en ambas claves para no
  // tocar la lógica de búsqueda de background.js (buildSearchVariants).
  const operacion =
    safeData.numero_operacion_solicitante || safeData.numero_operacion || "";
  return {
    numero_operacion_solicitante: operacion,
    numero_operacion_banco: operacion,
    importe: safeData.importe || safeData.monto || "",
    monto: safeData.monto || safeData.importe || "",
  };
}

// ── Depósito actual ──────────────────────────────────────────────────────
// Antes esto era una lista con un modal por item (se podían ir agregando
// varios depósitos desde el Kanban). Ya no hace falta: solo existe "Panel
// Lateral" desde el detalle de UN depósito, así que acá alcanza con pintar
// directo los datos + comprobante del item actual (o un estado vacío si no
// hay ninguno), sin lista ni overlay de por medio.

let currentItem = null;

async function loadQueueFromStorage() {
  const result = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  renderCurrentItem(result[QUEUE_STORAGE_KEY]?.items || []);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[QUEUE_STORAGE_KEY]) return;
  renderCurrentItem(changes[QUEUE_STORAGE_KEY].newValue?.items || []);
});

function renderCurrentItem(items) {
  queueItems = Array.isArray(items) ? items : [];
  currentItem = queueItems[0] || null;

  if (!currentItem) {
    elements.voucherTitle.textContent = "Voucher del depósito";
    elements.voucherBody.innerHTML =
      '<div class="queue-empty">Abre un depósito y usa el botón "Panel Lateral" en su detalle para mostrarlo acá.</div>';
    setZoomTarget(null);
    return;
  }

  renderVoucherBody(currentItem);
}

function renderVoucherBody(item) {
  const data = item.depositData || {};
  elements.voucherTitle.textContent = `${data.banco || "-"} · ${data.cliente || "Sin cliente"}`;

  // Cada guardado de un campo (blur/change de CUALQUIER input, incluso desde
  // este mismo side panel) dispara chrome.storage.onChanged -> renderCurrentItem()
  // -> acá. Reconstruir todo el HTML en cada uno de esos casos tira abajo y
  // vuelve a crear la <img> del voucher, lo que se ve como que la imagen
  // "recarga" con cada tecla/campo guardado (además de resetear zoom/rotación
  // y perder texto en tránsito de otros inputs). Si sigue siendo el MISMO
  // depósito, alcanza con actualizar los valores de los campos a mano; el
  // voucher y el resto del DOM quedan intactos.
  const existingInner = elements.voucherBody.querySelector(".queue-item-detail-inner");
  if (existingInner && updateQueueItemDetailInPlace(existingInner, item, data)) {
    return;
  }

  elements.voucherBody.innerHTML = "";
  elements.voucherBody.appendChild(buildQueueItemDetailContent(item, data));
}

// Devuelve true si pudo actualizar in-place (mismo depósito, mismo banco --
// las opciones de Anexo no cambian). Devuelve false si hace falta un rebuild
// completo (depósito distinto, o cambió bancoId y el <select> de Anexo puede
// tener que mostrar otras opciones -- reconciliar eso a mano no vale la pena
// frente a simplemente reconstruir).
function updateQueueItemDetailInPlace(inner, item, data) {
  if (inner.dataset.itemId !== item.id) return false;
  if (inner.dataset.bancoId !== String(data.bancoId || "")) return false;

  const fieldValues = {
    cliente: data.cliente || "",
    moneda: data.moneda || "",
    anexo: data.anexo || "",
    monto: String(data.monto ?? data.importe ?? ""),
    numero_operacion_solicitante: data.numero_operacion_solicitante || data.numero_operacion || "",
    fecha_deposito: resolveDepositDate(data),
  };

  inner.querySelectorAll("[data-field]").forEach((el) => {
    // No pisar un campo que el usuario tiene enfocado ahora mismo (podría
    // estar escribiendo en otro campo del mismo item, o este resync llegó
    // por un cambio de otro campo que se guardó un instante antes).
    if (document.activeElement === el) return;
    const nextValue = fieldValues[el.dataset.field];
    if (nextValue === undefined) return;
    if (el.value !== nextValue) el.value = nextValue;
    if (el.dataset.required && nextValue.trim()) el.classList.remove("is-invalid");
  });

  const voucherUrl = normalizeVoucherUrl(data.voucherUrl || "");
  if (inner.dataset.voucherUrl !== voucherUrl) {
    inner.dataset.voucherUrl = voucherUrl;
    const previewWrap = inner.querySelector(".queue-item-preview");
    const mediaEl = inner.querySelector(".queue-item-preview-media");
    if (previewWrap && mediaEl) {
      previewWrap.classList.toggle("empty", !voucherUrl);
      mediaEl.innerHTML = "";
      if (voucherUrl) {
        renderVoucherPreview(mediaEl, voucherUrl);
      } else {
        setZoomTarget(null);
      }
    }
  }

  return true;
}

// Campos editables acá == los mismos que el usuario puede tocar en el
// formulario del detalle del depósito (DepositFormPanel: monto,
// numero_operacion_banco, fecha_deposito, moneda, cliente). Se guardan en
// chrome.storage sobre el depositData del item de la cola, y viajan de
// vuelta a la app vía confirmo:queue-updated -- KanbanPage.jsx los usa para
// precargar el formulario cuando el usuario abre/confirma ese depósito.
// Banco, Sucursal y Nro. de operación (solicitante) quedan de solo lectura:
// son datos de referencia, no campos que se editen en el detalle.
async function saveQueueItemFields(id, fields) {
  try {
    await chrome.runtime.sendMessage({ type: "EDIT_QUEUE_ITEM_FIELDS", id, fields });
  } catch (error) {
    console.warn("No se pudo guardar la edición del depósito:", error);
  }
}

// Extraído para poder reconstruir el <select>/<input> de Anexo cuando
// cambia el Banco (ver el listener de .queue-banco-select más abajo), sin
// tener que reconstruir todo el detalle del item.
// Filtra la tabla de cuentas bancarias (data.cuentasBancarias, array de
// {bancoId, anexo} de toda la empresa) por el banco elegido -- se consulta
// en vivo cada vez que cambia el <select> de Banco, en vez de depender de un
// mapa {bancoId: [anexos]} precalculado por la app (más simple de depurar:
// el dato crudo viaja una sola vez y acá se filtra tal cual).
function buildAnexoOptionsFromCuentas(cuentasBancarias, bancoId) {
  const cuentas = Array.isArray(cuentasBancarias) ? cuentasBancarias : [];
  return [
    ...new Set(
      cuentas
        .filter((c) => String(c?.bancoId || "") === String(bancoId || ""))
        .map((c) => c.anexo)
        .filter(Boolean),
    ),
  ];
}

// Orden fijo de Anexo para BCP, distinto por empresa -- mismo criterio que
// ya se aplica del lado de la app web (sortAnexosForBancoEmpresa en
// depositDetailModalHelpers.jsx). Para cualquier otro banco, o un anexo que
// no esté en esta lista (cuenta nueva todavía no contemplada), se deja tal
// cual venía -- nunca se oculta un anexo real por no estar acá.
const BCP_ANEXO_ORDER_POR_EMPRESA = [
  { match: "jch", order: ["RECAU MN", "RECAU ME", "CREDI MN", "CREDI ME", "LCRED MN", "LCRED ME", "YCREDMN"] },
  { match: "evolution", order: ["CREDI MN", "CREDI ME", "LCRED MN", "LCRED ME", "YCREDMN"] },
];

const normalizeAnexoKey = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, " ");

function sortAnexosForBcp(anexos, { bancoNombre, empresaTexto } = {}) {
  if (String(bancoNombre || "").toUpperCase() !== "BCP") return anexos;
  const empresaLower = String(empresaTexto || "").toLowerCase();
  const config = BCP_ANEXO_ORDER_POR_EMPRESA.find((c) => empresaLower.includes(c.match));
  if (!config) return anexos;

  const orderIndex = new Map(config.order.map((value, index) => [normalizeAnexoKey(value), index]));
  return [...anexos].sort((a, b) => {
    const indexA = orderIndex.has(normalizeAnexoKey(a)) ? orderIndex.get(normalizeAnexoKey(a)) : config.order.length;
    const indexB = orderIndex.has(normalizeAnexoKey(b)) ? orderIndex.get(normalizeAnexoKey(b)) : config.order.length;
    if (indexA !== indexB) return indexA - indexB;
    return String(a).localeCompare(String(b));
  });
}

function buildAnexoFieldMarkup(options, currentValue) {
  if (options.length > 0) {
    return `<select class="queue-edit-input" data-field="anexo" data-required="1">
        <option value=""${currentValue ? "" : " selected"}>Seleccionar</option>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}"${option === currentValue ? " selected" : ""}>${escapeHtml(option)}</option>`,
          )
          .join("")}
      </select>`;
  }
  return `<input type="text" class="queue-edit-input" data-field="anexo" data-required="1" value="${escapeHtml(currentValue)}" placeholder="Anexo" />`;
}

// ── Validación antes de marcar "Atender" ─────────────────────────────────
// Mismos campos que la app web pide como obligatorios en el detalle del
// depósito (ver DepositDetailModal.jsx, "Campos requeridos faltantes") --
// se marcan con data-required="1" en el markup de abajo. Banco queda afuera
// cuando es de solo lectura (<span>, sin bancoOptions): no hay nada que
// validar ahí, siempre viene con valor desde el depósito original.
function getInvalidRequiredFields(inner) {
  return Array.from(inner.querySelectorAll("[data-required]")).filter(
    (el) => !String(el.value || "").trim(),
  );
}

function markRequiredFieldsValidity(inner, invalidEls) {
  const invalidSet = new Set(invalidEls);
  inner.querySelectorAll("[data-required]").forEach((el) => {
    el.classList.toggle("is-invalid", invalidSet.has(el));
  });
}

// Wiring genérico de guardado (guardar-en-blur para texto, guardar-en-change
// para select/date) -- se extrajo a función aparte porque el <select> de
// Anexo se reconstruye dinámicamente al cambiar el Banco, y ese nuevo
// elemento necesita el mismo wiring que los que ya estaban en el HTML
// inicial.
function wireEditInput(editEl, itemId) {
  editEl.addEventListener("click", (event) => event.stopPropagation());
  editEl.addEventListener("mousedown", (event) => event.stopPropagation());

  // Si el campo se marcó en rojo por la validación de "Atender" (ver más
  // abajo, getInvalidRequiredFields/markRequiredFieldsValidity), sacarle el
  // rojo apenas el usuario le pone un valor -- no hace falta esperar a que
  // vuelva a tocar "Atender" para que desaparezca.
  if (editEl.dataset.required) {
    const clearInvalidIfFilled = () => {
      if (String(editEl.value || "").trim()) editEl.classList.remove("is-invalid");
    };
    editEl.addEventListener("input", clearInvalidIfFilled);
    editEl.addEventListener("change", clearInvalidIfFilled);
  }

  const commit = () => {
    const field = editEl.dataset.field;
    const value = editEl.value;
    if (field === "monto") {
      void saveQueueItemFields(itemId, { monto: value, importe: value });
      return;
    }
    if (field === "anexo") {
      const inner = editEl.closest(".queue-item-detail-inner");
      if (inner) checkAnexoMonedaMismatch(inner, value);
    }
    void saveQueueItemFields(itemId, { [field]: value });
  };

  if (editEl.tagName === "SELECT" || editEl.type === "date") {
    editEl.addEventListener("change", (event) => {
      event.stopPropagation();
      commit();
    });
  } else {
    editEl.addEventListener("blur", commit);
    editEl.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        editEl.blur();
      }
    });
  }
}

function buildQueueItemDetailContent(item, data) {
  const inner = document.createElement("div");
  inner.className = "queue-item-detail-inner";

  const voucherUrl = normalizeVoucherUrl(data.voucherUrl || "");
  // Huella para que updateQueueItemDetailInPlace (más arriba) sepa, la
  // próxima vez que llegue un cambio de storage, si alcanza con actualizar
  // valores a mano o hace falta reconstruir todo (depósito distinto, o
  // cambió el banco y el <select> de Anexo puede tener otras opciones).
  inner.dataset.itemId = item.id;
  inner.dataset.bancoId = String(data.bancoId || "");
  inner.dataset.voucherUrl = voucherUrl;
  // Un solo campo de operación: numero_operacion_banco era un vestigio de un
  // sistema anterior, ya no se usa para nada -- backend/BD trabajan solo con
  // "numero_operacion" (acá guardado en data.numero_operacion_solicitante,
  // mismo nombre que usa DepositDetailModal.jsx para este mismo dato).
  const operationValue = data.numero_operacion_solicitante || data.numero_operacion || "";
  const rawAmount = data.monto ?? data.importe ?? "";
  const moneda = data.moneda || "";
  const currentAnexo = data.anexo || "";
  // Se recalcula SIEMPRE a partir de cuentasBancarias + bancoId actual, en
  // vez de leer data.anexoOptions (ese campo se calculó una sola vez al
  // agregar a la cola, para el banco de ESE momento, y nunca se vuelve a
  // tocar). Esto importa porque chrome.storage.onChanged dispara un
  // renderQueue() completo cada vez que se guarda CUALQUIER campo -- incluido
  // el propio guardado de bancoId al cambiar de banco -- así que este
  // contenido se reconstruye desde cero un instante después de cualquier
  // cambio, y si acá se siguiera leyendo data.anexoOptions se pisaría el
  // <select> recién actualizado con la lista vieja del banco original.
  // Si el depósito no tiene cuentasBancarias (se agregó a la cola antes de
  // esta actualización), se cae a data.anexoOptions como respaldo.
  const cuentasBancarias = Array.isArray(data.cuentasBancarias) ? data.cuentasBancarias : [];
  const anexoOptionsRaw = cuentasBancarias.length
    ? buildAnexoOptionsFromCuentas(cuentasBancarias, data.bancoId)
    : Array.isArray(data.anexoOptions)
      ? data.anexoOptions
      : [];
  const anexoOptions = sortAnexosForBcp(anexoOptionsRaw, {
    bancoNombre: data.banco,
    empresaTexto: data.empresa,
  });
  const anexoFieldHtml = buildAnexoFieldMarkup(anexoOptions, currentAnexo);

  // Verificación OCR (Llama vs. Vision) -- ver campoVerificacionOcr más
  // arriba. verificacionOcr viaja en depositData tal cual la mandó la app
  // web (useDepositQueue.js); items agregados a la cola antes de esa
  // actualización simplemente no tienen el campo y no se pinta nada.
  const verificacionOcr = data.verificacionOcr || null;
  const vMoneda = campoVerificacionOcr(verificacionOcr, "moneda");
  const vMonto = campoVerificacionOcr(verificacionOcr, "monto");
  const vFecha = campoVerificacionOcr(verificacionOcr, "fecha_deposito");
  const monedaVerifClass = claseSegunAccionOcr(vMoneda?.accion);
  const montoVerifClass = claseSegunAccionOcr(vMonto?.accion);
  const fechaVerifClass = claseSegunAccionOcr(vFecha?.accion);
  const monedaVerifTitle = motivoVisibleOcr(vMoneda);
  const montoVerifTitle = motivoVisibleOcr(vMonto);
  const fechaVerifTitle = motivoVisibleOcr(vFecha);
  const verifNoteHtml = (text) =>
    text ? `<p class="field-verif-note">${escapeHtml(text)}</p>` : "";

  // Banco: editable si la app mandó el catálogo (bancoOptions); si no, se
  // muestra de solo lectura igual que Sucursal (un texto libre no serviría,
  // el resto del formulario necesita el id real del banco).
  const bancoOptions = Array.isArray(data.bancoOptions) ? data.bancoOptions : [];
  const bancoFieldHtml =
    bancoOptions.length > 0
      ? `<select class="queue-edit-input queue-banco-select" data-field="bancoId" data-required="1">
          <option value=""${data.bancoId ? "" : " selected"}>Seleccionar</option>
          ${bancoOptions
            .map(
              (banco) =>
                `<option value="${escapeHtml(banco.id)}"${String(banco.id) === String(data.bancoId || "") ? " selected" : ""}>${escapeHtml(banco.nombre)}</option>`,
            )
            .join("")}
        </select>`
      : `<span class="value">${escapeHtml(data.banco || "-")}</span>`;

  inner.innerHTML = `
    <div class="queue-item-fields queue-item-fields--empresa">
      <div class="queue-item-field">
        <span class="label">Empresa</span>
        <span class="value">${escapeHtml(data.empresa || "-")}</span>
      </div>
      <div class="queue-item-field">
        <span class="label">Cliente</span>
        <input type="text" class="queue-edit-input" data-field="cliente" data-required="1" value="${escapeHtml(data.cliente || "")}" placeholder="Nombre del cliente" />
      </div>
    </div>

    <div class="queue-item-fields queue-item-fields--trio">
      <div class="queue-item-field">
        <span class="label">Banco</span>
        ${bancoFieldHtml}
      </div>
      <div class="queue-item-field">
        <span class="label">Moneda</span>
        <select class="queue-edit-input ${monedaVerifClass}" data-field="moneda" data-required="1" title="${escapeHtml(monedaVerifTitle)}">
          <option value=""${moneda ? "" : " selected"}>Seleccionar</option>
          <option value="PEN"${moneda === "PEN" ? " selected" : ""}>Soles (PEN)</option>
          <option value="USD"${moneda === "USD" ? " selected" : ""}>Dólares (USD)</option>
        </select>
        ${verifNoteHtml(monedaVerifTitle)}
      </div>
      <div class="queue-item-field" data-anexo-cell>
        <span class="label">Anexo</span>
        ${anexoFieldHtml}
      </div>
    </div>

    <div class="queue-item-fields queue-item-fields--trio">
      <div class="queue-item-field">
        <span class="label label--with-action">
          <span>Importe</span>
          <button type="button" class="field-search-btn queue-search-amount-btn" title="Buscar importe" aria-label="Buscar importe">${SEARCH_ICON_SVG}</button>
        </span>
        <input type="number" step="0.01" class="queue-edit-input ${montoVerifClass}" data-field="monto" data-required="1" value="${escapeHtml(rawAmount)}" placeholder="0.00" title="${escapeHtml(montoVerifTitle)}" />
        ${verifNoteHtml(montoVerifTitle)}
      </div>
      <div class="queue-item-field">
        <span class="label label--with-action">
          <span>Número de operación</span>
          <button type="button" class="field-search-btn queue-search-op-btn" title="Buscar nro. operación" aria-label="Buscar nro. operación">${SEARCH_ICON_SVG}</button>
        </span>
        <input type="text" class="queue-edit-input" data-field="numero_operacion_solicitante" data-required="1" value="${escapeHtml(operationValue)}" placeholder="Número de operación" />
      </div>
      <div class="queue-item-field">
        <span class="label label--with-action">
          <span>Fecha depósito</span>
          <button type="button" class="field-today-btn queue-date-today-btn" title="Usar fecha de hoy" aria-label="Usar fecha de hoy">${TODAY_ICON_SVG}</button>
        </span>
        <input type="date" class="queue-edit-input ${fechaVerifClass}" data-field="fecha_deposito" data-required="1" value="${escapeHtml(resolveDepositDate(data))}" title="${escapeHtml(fechaVerifTitle)}" />
        ${verifNoteHtml(fechaVerifTitle)}
      </div>
    </div>
    <div class="queue-item-search-status search-status">Busca por nro. operación o importe en la pestaña activa.</div>

    <div class="queue-item-actions">
      <button type="button" class="link-button queue-item-attend-btn">Guardar cambios</button>
      <button type="button" class="link-button queue-item-remove-btn">Quitar</button>
    </div>

    <div class="preview queue-item-preview${voucherUrl ? "" : " empty"}">
      <div class="queue-item-preview-media"></div>
      ${
        voucherUrl
          ? `<div class="preview-toolbar">
              <a class="preview-icon-btn queue-open-link" href="${voucherUrl}" target="_blank" rel="noreferrer" title="Abrir en pestaña nueva">↗</a>
              ${!isPdfUrl(voucherUrl) ? `<button type="button" class="preview-icon-btn queue-rotate-btn" title="Rotar imagen">⟳</button>` : ""}
            </div>`
          : '<div class="empty-state">Sin comprobante para este depósito.</div>'
      }
    </div>
  `;

  const previewEl = inner.querySelector(".queue-item-preview-media");
  if (voucherUrl) {
    renderVoucherPreview(previewEl, voucherUrl);
  }

  // El <select> de Banco se excluye del wiring genérico a propósito: tiene
  // su propio listener más abajo que YA guarda bancoId (junto con el reset
  // de anexo). Si además se le enganchara wireEditInput acá, quedarían DOS
  // listeners de "change" mandando saveQueueItemFields en paralelo -- ambos
  // leen/escriben chrome.storage de forma async, así que el que termine
  // último podía pisar el `anexo: ""` del reset con el estado viejo (race
  // condition), dejando el <select> de Anexo mostrando algo que ya no
  // corresponde al banco elegido.
  inner.querySelectorAll(".queue-edit-input").forEach((editEl) => {
    if (editEl.classList.contains("queue-banco-select")) return;
    wireEditInput(editEl, item.id);
  });

  // Cambiar el Banco: refresca el <select> de Anexo con las opciones del
  // banco nuevo y resetea su valor. En vez de un mapa {bancoId: [anexos]}
  // precalculado, se consulta en vivo la tabla cruda de cuentas bancarias
  // (data.cuentasBancarias) filtrando por el banco elegido -- más simple de
  // depurar, el dato viaja una sola vez y se filtra acá mismo.
  const bancoSelectEl = inner.querySelector(".queue-banco-select");
  if (bancoSelectEl) {
    bancoSelectEl.addEventListener("change", (event) => {
      event.stopPropagation();
      if (bancoSelectEl.value) bancoSelectEl.classList.remove("is-invalid");

      const newBancoId = bancoSelectEl.value;
      const selectedBanco = (Array.isArray(data.bancoOptions) ? data.bancoOptions : []).find(
        (banco) => String(banco.id) === String(newBancoId),
      );

      const anexoCell = inner.querySelector("[data-anexo-cell]");
      if (anexoCell) {
        const cuentasBancarias = Array.isArray(data.cuentasBancarias) ? data.cuentasBancarias : [];
        const newAnexoOptions = sortAnexosForBcp(
          buildAnexoOptionsFromCuentas(cuentasBancarias, newBancoId),
          { bancoNombre: selectedBanco?.nombre, empresaTexto: data.empresa },
        );
        if (!cuentasBancarias.length) {
          // Este depósito se agregó a la cola ANTES de que se mandara este
          // catálogo (versión vieja de la extensión/app, o el item quedó en
          // la cola de una sesión anterior) -- no hay forma de recalcularlo
          // acá (el side panel no tiene sesión propia). Quitarlo y volver a
          // agregarlo desde el Kanban/detalle lo arregla.
          console.warn(
            "Este depósito no tiene la tabla de cuentas bancarias (cuentasBancarias vacía). Probablemente se agregó a la cola antes de esta actualización -- quitalo y volvé a agregarlo.",
          );
        }
        const labelEl = anexoCell.querySelector(".label");
        anexoCell.innerHTML = "";
        if (labelEl) anexoCell.appendChild(labelEl);
        anexoCell.insertAdjacentHTML("beforeend", buildAnexoFieldMarkup(newAnexoOptions, ""));
        const newAnexoEl = anexoCell.querySelector(".queue-edit-input");
        if (newAnexoEl) wireEditInput(newAnexoEl, item.id);
      }

      void saveQueueItemFields(item.id, {
        bancoId: newBancoId,
        banco: selectedBanco?.nombre || "",
        anexo: "",
      });
    });
  }

  inner.querySelector(".queue-rotate-btn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    rotateVoucherImage();
  });

  inner.querySelector(".queue-date-today-btn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const fechaEl = inner.querySelector('[data-field="fecha_deposito"]');
    if (!fechaEl) return;
    fechaEl.value = getTodayDateInputValue();
    // Los <input type="date"> se guardan en el "change" de wireEditInput,
    // así que hace falta dispararlo a mano -- setear .value con JS no
    // dispara ningún evento solo.
    fechaEl.dispatchEvent(new Event("change", { bubbles: true }));
  });

  inner.querySelector(".queue-search-op-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    void runQueueItemSearch(item, "operation", inner);
  });
  inner.querySelector(".queue-search-amount-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    void runQueueItemSearch(item, "amount", inner);
  });
  const attendBtn = inner.querySelector(".queue-item-attend-btn");
  attendBtn.addEventListener("click", async (event) => {
    event.stopPropagation();

    // Los campos ya se guardan solos en cada blur/change (ver wireEditInput);
    // este botón solo valida que estén completos y que Anexo/Empresa
    // coincidan con la página del banco antes de confirmar con un toast que
    // "quedó todo bien". No hay ningún estado de "atendido" que guardar --
    // eso era parte de la cola de varios depósitos que ya no existe.
    const invalidEls = getInvalidRequiredFields(inner);
    markRequiredFieldsValidity(inner, invalidEls);
    if (invalidEls.length > 0) {
      invalidEls[0].focus();
      invalidEls[0].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Anexo/Empresa vs. la página del banco (mismo criterio que
    // "Comprobar Duplicados" en la app web, ver useDepositActions.js
    // handleCheckDuplicates): si la combinación Empresa+Anexo elegida
    // tiene una fila en ANEXO_VALIDATION_RULES, hay que encontrar TANTO
    // la empresa como el dato de cuenta en la pestaña activa antes de
    // dejar guardar -- si falta alguno de los dos, se bloquea.
    const empresaNombre = item.depositData?.empresa || "";
    const anexoEl = inner.querySelector('[data-field="anexo"]');
    const anexoValue = anexoEl?.value || item.depositData?.anexo || "";
    const rule = findAnexoValidationRule(empresaNombre, anexoValue);
    if (rule) {
      const originalLabel = attendBtn.textContent;
      attendBtn.disabled = true;
      attendBtn.textContent = "Validando...";
      try {
        const result = await chrome.runtime.sendMessage({
          type: "SEARCH_ANEXO_VALIDATION_IN_PAGE",
          empresaValidar: rule.empresaValidar,
          datoValidar: rule.datoValidar,
        });
        if (!result?.ok) {
          showToast(`No se pudo validar anexo/empresa: ${result?.message || "error desconocido"}.`, "error");
          attendBtn.disabled = false;
          attendBtn.textContent = originalLabel;
          return;
        }
        const faltantes = [];
        if (!result.empresaFound) faltantes.push(`empresa "${rule.empresaValidar}"`);
        if (!result.datoFound) faltantes.push(`dato "${rule.datoValidar}"`);
        if (faltantes.length > 0) {
          showToast(
            `No se encontró en la pestaña activa: ${faltantes.join(" ni ")}. Revisá que el Anexo/Empresa elegidos coincidan con la cuenta del voucher.`,
            "error",
          );
          attendBtn.disabled = false;
          attendBtn.textContent = originalLabel;
          return;
        }
      } catch (error) {
        showToast(`Error al validar anexo/empresa: ${error.message}`, "error");
        attendBtn.disabled = false;
        attendBtn.textContent = originalLabel;
        return;
      }
      attendBtn.disabled = false;
      attendBtn.textContent = originalLabel;
    }

    showToast("Datos grabados");
  });
  inner.querySelector(".queue-item-remove-btn").addEventListener("click", async (event) => {
    event.stopPropagation();
    await chrome.runtime.sendMessage({ type: "REMOVE_FROM_QUEUE", id: item.id });
  });

  return inner;
}

function renderVoucherPreview(container, voucherUrl) {
  const iframeMarkup = `<iframe src="${voucherUrl}#toolbar=1&navpanes=1&scrollbar=1" title="Voucher"></iframe>`;

  if (isPdfUrl(voucherUrl)) {
    container.innerHTML = iframeMarkup;
    return;
  }

  container.innerHTML = `<img src="${voucherUrl}" alt="Voucher del depósito" />`;
  const img = container.querySelector("img");
  if (!img) return;

  img.addEventListener(
    "error",
    () => {
      container.innerHTML = iframeMarkup;
      setZoomTarget(null);
    },
    { once: true },
  );

  setupVoucherZoom(container);
  setZoomTarget(img);
}

async function runQueueItemSearch(item, searchType, inner) {
  const statusEl = inner.querySelector(".queue-item-search-status");
  const payload = getSearchPayloadFromDepositData(item.depositData);
  statusEl.textContent =
    searchType === "amount"
      ? "Buscando importe en la pestaña activa..."
      : "Buscando nro. operación en la pestaña activa...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SEARCH_VOUCHER_IN_PAGE",
      depositData: payload,
      searchType,
    });

    if (response?.found) {
      statusEl.textContent = `Encontrado: ${response.term} (${response.matches} coincidencia${response.matches === 1 ? "" : "s"})`;
    } else {
      statusEl.textContent = response?.message || "No se encontró coincidencia.";
    }
  } catch (error) {
    statusEl.textContent = `Error al buscar: ${error.message}`;
  }
}

// ── Zoom del voucher con la rueda del mouse (mismo comportamiento de antes,
// pero ahora se re-targetea al contenedor del item que esté abierto en cada
// momento, ya que solo hay un voucher visible a la vez). ────────────────────
let zoomImg = null;
let zoomScale = 1;
let zoomTx = 0;
let zoomTy = 0;
let zoomDragging = false;
let zoomLastX = 0;
let zoomLastY = 0;
// Rotación del voucher (botón "Rotar imagen", en múltiplos de 90°) -- se
// resetea a 0 cada vez que se abre/renderiza un item distinto (setZoomTarget),
// no se persiste entre aperturas.
let zoomRotation = 0;

function applyVoucherZoom() {
  if (!zoomImg) return;
  zoomImg.style.transform = `translate(${zoomTx}px, ${zoomTy}px) scale(${zoomScale}) rotate(${zoomRotation}deg)`;
  zoomImg.style.cursor = zoomScale > 1 ? (zoomDragging ? "grabbing" : "grab") : "default";
}

function rotateVoucherImage() {
  if (!zoomImg) return;
  zoomRotation = (zoomRotation + 90) % 360;
  applyVoucherZoom();
}

function setZoomTarget(img) {
  zoomImg = img || null;
  zoomScale = 1;
  zoomTx = 0;
  zoomTy = 0;
  zoomRotation = 0;
  zoomDragging = false;
  if (zoomImg) {
    zoomImg.style.transformOrigin = "center center";
    zoomImg.style.transition = "transform 0.06s ease-out";
    zoomImg.style.willChange = "transform";
    applyVoucherZoom();
  }
}

function setupVoucherZoom(container) {
  if (!container || container.dataset.zoomBound === "1") return;
  container.dataset.zoomBound = "1";

  container.addEventListener(
    "wheel",
    (event) => {
      if (!zoomImg) return;
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.2 : -0.2;
      zoomScale = Math.min(Math.max(zoomScale + step, 1), 6);
      if (zoomScale === 1) {
        zoomTx = 0;
        zoomTy = 0;
      }
      applyVoucherZoom();
    },
    { passive: false },
  );

  container.addEventListener("mousedown", (event) => {
    if (!zoomImg || zoomScale <= 1) return;
    zoomDragging = true;
    zoomLastX = event.clientX;
    zoomLastY = event.clientY;
    applyVoucherZoom();
    event.preventDefault();
  });

  container.addEventListener("mousemove", (event) => {
    if (!zoomDragging) return;
    zoomTx += event.clientX - zoomLastX;
    zoomTy += event.clientY - zoomLastY;
    zoomLastX = event.clientX;
    zoomLastY = event.clientY;
    applyVoucherZoom();
  });

  const stopDrag = () => {
    if (!zoomDragging) return;
    zoomDragging = false;
    applyVoucherZoom();
  };
  container.addEventListener("mouseup", stopDrag);
  container.addEventListener("mouseleave", stopDrag);

  container.addEventListener("dblclick", () => {
    zoomScale = 1;
    zoomTx = 0;
    zoomTy = 0;
    applyVoucherZoom();
  });
}

loadQueueFromStorage().catch((error) => {
  console.error("No se pudo cargar el depósito del panel lateral:", error);
  renderCurrentItem([]);
});
