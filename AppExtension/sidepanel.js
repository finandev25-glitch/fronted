const QUEUE_STORAGE_KEY = "voucher_queue_state";

const elements = {
  queueList: document.getElementById("queueList"),
  queueCount: document.getElementById("queueCount"),
};

let queueItems = [];
let openQueueItemId = null;

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

// ── Cola de depósitos ────────────────────────────────────────────────────
// Es el ÚNICO contenido del side panel: no hay un "voucher actual" aparte --
// tanto agregar un depósito desde el Kanban (varios a la vez) como abrir
// "Panel Lateral" desde el detalle (uno solo) usan el mismo mecanismo de
// cola, así que acá solo hace falta pintar la lista y, al expandir un item,
// sus datos + comprobante.

async function loadQueueFromStorage() {
  const result = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  renderQueue(result[QUEUE_STORAGE_KEY]?.items || []);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[QUEUE_STORAGE_KEY]) return;
  renderQueue(changes[QUEUE_STORAGE_KEY].newValue?.items || []);
});

function renderQueue(items) {
  queueItems = Array.isArray(items) ? items : [];
  elements.queueCount.textContent = String(queueItems.length);

  if (queueItems.length === 0) {
    openQueueItemId = null;
    setZoomTarget(null);
    elements.queueList.innerHTML =
      '<div class="queue-empty">Agrega depósitos a la cola desde el botón de la tarjeta en el Kanban, o con "Panel Lateral" dentro del detalle de un depósito.</div>';
    return;
  }

  // Si el item expandido ya no existe (se quitó de la cola), se cierra.
  if (openQueueItemId && !queueItems.some((item) => item.id === openQueueItemId)) {
    openQueueItemId = null;
  }

  // Más nuevos primero.
  const sorted = queueItems
    .slice()
    .sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));

  elements.queueList.innerHTML = "";
  sorted.forEach((item) => {
    elements.queueList.appendChild(buildQueueItemNode(item));
  });
}

function buildQueueItemNode(item) {
  const data = item.depositData || {};
  const isOpen = item.id === openQueueItemId;

  const wrapper = document.createElement("div");
  wrapper.className = `queue-item${item.atendido ? " is-attended" : ""}${isOpen ? " is-open" : ""}`;

  const row = document.createElement("div");
  row.className = "queue-item-row";
  row.innerHTML = `
    <span class="queue-item-dot"></span>
    <div class="queue-item-main">
      <span class="queue-item-bank">${escapeHtml(data.banco || "-")} · ${escapeHtml(data.cliente || "Sin cliente")}</span>
      <span class="queue-item-sub">${escapeHtml(data.sucursal || "-")}</span>
    </div>
    <span class="queue-item-amount">${formatAmount(data.monto || data.importe)}</span>
    ${buildLockBadgeHtml(data)}
    <svg class="queue-item-chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
  `;

  row.addEventListener("click", () => {
    openQueueItemId = openQueueItemId === item.id ? null : item.id;
    renderQueue(queueItems);
  });

  wrapper.appendChild(row);

  const detail = document.createElement("div");
  detail.className = "queue-item-detail";

  // Solo se arma el contenido pesado (campos + imagen) del item ABIERTO --
  // los demás quedan colapsados sin nada dentro, así no se cargan N
  // imágenes de voucher a la vez.
  if (isOpen) {
    detail.appendChild(buildQueueItemDetailContent(item, data));
  }

  wrapper.appendChild(detail);
  return wrapper;
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

function buildAnexoFieldMarkup(options, currentValue) {
  if (options.length > 0) {
    return `<select class="queue-edit-input" data-field="anexo">
        <option value=""${currentValue ? "" : " selected"}>Seleccionar</option>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}"${option === currentValue ? " selected" : ""}>${escapeHtml(option)}</option>`,
          )
          .join("")}
      </select>`;
  }
  return `<input type="text" class="queue-edit-input" data-field="anexo" value="${escapeHtml(currentValue)}" placeholder="Anexo" />`;
}

// Wiring genérico de guardado (guardar-en-blur para texto, guardar-en-change
// para select/date) -- se extrajo a función aparte porque el <select> de
// Anexo se reconstruye dinámicamente al cambiar el Banco, y ese nuevo
// elemento necesita el mismo wiring que los que ya estaban en el HTML
// inicial.
function wireEditInput(editEl, itemId) {
  editEl.addEventListener("click", (event) => event.stopPropagation());
  editEl.addEventListener("mousedown", (event) => event.stopPropagation());

  const commit = () => {
    const field = editEl.dataset.field;
    const value = editEl.value;
    if (field === "monto") {
      void saveQueueItemFields(itemId, { monto: value, importe: value });
      return;
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
  const anexoOptions = cuentasBancarias.length
    ? buildAnexoOptionsFromCuentas(cuentasBancarias, data.bancoId)
    : Array.isArray(data.anexoOptions)
      ? data.anexoOptions
      : [];
  const anexoFieldHtml = buildAnexoFieldMarkup(anexoOptions, currentAnexo);

  // Banco: editable si la app mandó el catálogo (bancoOptions); si no, se
  // muestra de solo lectura igual que Sucursal (un texto libre no serviría,
  // el resto del formulario necesita el id real del banco).
  const bancoOptions = Array.isArray(data.bancoOptions) ? data.bancoOptions : [];
  const bancoFieldHtml =
    bancoOptions.length > 0
      ? `<select class="queue-edit-input queue-banco-select" data-field="bancoId">
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
      <div class="queue-item-field field--full">
        <span class="label">Empresa</span>
        <span class="value">${escapeHtml(data.empresa || "-")}</span>
      </div>
    </div>

    <div class="queue-item-fields queue-item-fields--trio">
      <div class="queue-item-field">
        <span class="label">Banco</span>
        ${bancoFieldHtml}
      </div>
      <div class="queue-item-field">
        <span class="label">Moneda</span>
        <select class="queue-edit-input" data-field="moneda">
          <option value=""${moneda ? "" : " selected"}>Seleccionar</option>
          <option value="PEN"${moneda === "PEN" ? " selected" : ""}>Soles (PEN)</option>
          <option value="USD"${moneda === "USD" ? " selected" : ""}>Dólares (USD)</option>
        </select>
      </div>
      <div class="queue-item-field" data-anexo-cell>
        <span class="label">Anexo</span>
        ${anexoFieldHtml}
      </div>
    </div>

    <div class="queue-item-fields">
      <div class="queue-item-field">
        <span class="label">Fecha depósito</span>
        <input type="date" class="queue-edit-input" data-field="fecha_deposito" value="${escapeHtml(resolveDepositDate(data))}" />
      </div>
      <div class="queue-item-field">
        <span class="label">Número de operación</span>
        <input type="text" class="queue-edit-input" data-field="numero_operacion_solicitante" value="${escapeHtml(operationValue)}" placeholder="Número de operación" />
      </div>
      <div class="queue-item-field field--full">
        <span class="label">Importe</span>
        <input type="number" step="0.01" class="queue-edit-input" data-field="monto" value="${escapeHtml(rawAmount)}" placeholder="0.00" />
      </div>
      <div class="queue-item-field field--full">
        <span class="label">Cliente</span>
        <input type="text" class="queue-edit-input" data-field="cliente" value="${escapeHtml(data.cliente || "")}" placeholder="Nombre del cliente" />
      </div>
    </div>

    <div class="queue-item-actions">
      <button type="button" class="link-button link-button--secondary queue-search-op-btn">Buscar nro. operación</button>
      <button type="button" class="link-button link-button--secondary queue-search-amount-btn">Buscar importe</button>
    </div>
    <div class="queue-item-search-status search-status">Busca por nro. operación o importe en la pestaña activa.</div>

    <div class="preview queue-item-preview${voucherUrl ? "" : " empty"}">
      ${voucherUrl ? "" : '<div class="empty-state">Sin comprobante para este depósito.</div>'}
    </div>

    <div class="queue-item-actions">
      ${voucherUrl ? `<a class="link-button queue-open-link" href="${voucherUrl}" target="_blank" rel="noreferrer">Abrir en pestaña nueva</a>` : ""}
      ${voucherUrl && !isPdfUrl(voucherUrl) ? `<button type="button" class="link-button link-button--secondary queue-rotate-btn">⟳ Rotar imagen</button>` : ""}
    </div>
    <div class="queue-item-actions">
      <button type="button" class="link-button queue-item-attend-btn">${item.atendido ? "Desmarcar atendido" : "Marcar como atendido"}</button>
      <button type="button" class="link-button queue-item-remove-btn">Quitar de la cola</button>
    </div>
  `;

  const previewEl = inner.querySelector(".queue-item-preview");
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

      const newBancoId = bancoSelectEl.value;
      const selectedBanco = (Array.isArray(data.bancoOptions) ? data.bancoOptions : []).find(
        (banco) => String(banco.id) === String(newBancoId),
      );

      const anexoCell = inner.querySelector("[data-anexo-cell]");
      if (anexoCell) {
        const cuentasBancarias = Array.isArray(data.cuentasBancarias) ? data.cuentasBancarias : [];
        const newAnexoOptions = buildAnexoOptionsFromCuentas(cuentasBancarias, newBancoId);
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

  inner.querySelector(".queue-search-op-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    void runQueueItemSearch(item, "operation", inner);
  });
  inner.querySelector(".queue-search-amount-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    void runQueueItemSearch(item, "amount", inner);
  });
  inner.querySelector(".queue-item-attend-btn").addEventListener("click", async (event) => {
    event.stopPropagation();
    await chrome.runtime.sendMessage({
      type: "MARK_QUEUE_ITEM_ATTENDED",
      id: item.id,
      atendido: !item.atendido,
    });
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
  console.error("No se pudo cargar la cola de depósitos:", error);
  renderQueue([]);
});
