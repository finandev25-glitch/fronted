const QUEUE_STORAGE_KEY = "voucher_queue_state";

// ── Compatibilidad Chrome / Firefox ──────────────────────────────────────
// Firefox no implementa chrome.sidePanel (API exclusiva de Chrome) -- usa su
// propio modelo de sidebar, con browser.sidebarAction (API distinta, sin
// setOptions() por pestaña: el sidebar de Firefox es por ventana, no por
// tab). El resto de la extensión (chrome.storage, chrome.tabs,
// chrome.scripting, chrome.runtime) funciona igual en ambos navegadores via
// el alias chrome.* que Firefox provee, asi que NO se toca nada de eso.
// Todo lo de abajo que ya usaba chrome.sidePanel queda intacto (Chrome sigue
// exactamente igual); solo se agregan ramas "else" para Firefox.
const isFirefox = typeof browser !== "undefined" && !!browser.sidebarAction;

// ── Depósito actual: ÚNICO mecanismo del side panel ─────────────────────────
//
// Antes esto era una cola de varios depósitos (se podían ir agregando desde
// el Kanban sin abrir el panel). ¿Ya no hace falta? Ahora solo existe un
// camino para mostrar algo acá: el botón "Panel Lateral" del detalle de UN
// depósito, que además pide abrir el side panel de una (openPanel: true).
// Por simplicidad se guarda como el mismo shape de antes -- { items: [...] },
// pero con como máximo UN elemento -- así sidepanel.js y el hook
// useDepositQueue.js del lado de la app no necesitan cambiar su forma de leer
// el estado ni su lógica de "detectar que un id salió y liberar su candado".
//
// Modelo: { items: [{ id, depositData, addedAt }] } (0 o 1 elemento),
// guardado en chrome.storage.local bajo QUEUE_STORAGE_KEY, leído de forma
// reactiva por sidepanel.js vía chrome.storage.onChanged.

async function getQueueState() {
  const result = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  return result[QUEUE_STORAGE_KEY] || { items: [] };
}

async function setQueueState(state) {
  await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: state });
  return state;
}

// Reemplaza lo que hubiera antes -- ya no se acumula, un depósito nuevo
// desplaza al que estaba mostrando el panel.
async function addToQueue({ id, depositData }) {
  if (!id) return getQueueState();
  const nowIso = new Date().toISOString();
  return setQueueState({ items: [{ id, depositData: depositData || null, addedAt: nowIso }] });
}

async function removeFromQueue({ id }) {
  if (!id) return getQueueState();
  const state = await getQueueState();
  const items = (state.items || []).filter((item) => item.id !== id);
  return setQueueState({ items });
}

// Edición de campos desde el side panel (fecha, nro. op. banco, importe,
// moneda, cliente): se fusionan sobre el depositData ya guardado, sin tocar
// el resto (voucherUrl, banco, sucursal, etc.). Esto es lo que luego lee
// KanbanPage.jsx (vía confirmo:queue-updated) para precargar el formulario
// del detalle del depósito con lo que el usuario corrigió acá.
async function updateQueueItemFields({ id, fields }) {
  if (!id || !fields) return getQueueState();
  const state = await getQueueState();
  const items = (state.items || []).map((item) =>
    item.id === id
      ? { ...item, depositData: { ...item.depositData, ...fields } }
      : item,
  );
  return setQueueState({ items });
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeOperationNumber(value) {
  const digits = normalizeDigits(value).replace(/^0+(?=\d)/, "");
  return digits || "0";
}

function buildSearchVariants(payload, searchType = "both") {
  const variants = [];
  const add = (value) => {
    const normalized = normalizeSearchValue(value);
    if (normalized && !variants.includes(normalized)) {
      variants.push(normalized);
    }
  };

  const shouldSearchOperation = searchType === "operation" || searchType === "both";
  const shouldSearchAmount = searchType === "amount" || searchType === "both";

  if (shouldSearchOperation) {
    const solicitante = payload?.numero_operacion_solicitante;
    const banco = payload?.numero_operacion_banco;

    add(solicitante);
    add(banco);

    const normalizedSolicitante = normalizeOperationNumber(solicitante);
    const normalizedBanco = normalizeOperationNumber(banco);

    add(normalizedSolicitante);
    add(normalizedBanco);
  }

  if (shouldSearchAmount) {
    add(payload?.importe);
    const amount = payload?.monto;
    if (amount !== undefined && amount !== null && amount !== "") {
      add(amount);
      const numericAmount = Number(String(amount).replace(/[^0-9,.-]/g, "").replace(",", "."));
      if (!Number.isNaN(numericAmount)) {
        add(numericAmount.toFixed(2));
        add(numericAmount.toLocaleString("en-US"));
        add(numericAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        add(numericAmount.toLocaleString("es-PE"));
        add(numericAmount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
    }
  }

  return variants;
}

// Búsqueda de texto plano (sin resaltar, sin dígitos/variantes de monto) --
// usada por la validación Anexo/Empresa (ver SEARCH_ANEXO_VALIDATION_IN_PAGE
// más abajo y findAnexoValidationRule en sidepanel.js): solo hace falta
// saber si el texto de la empresa/cuenta a validar aparece en la página, no
// resaltarlo ni hacer scroll -- lo hace searchInActiveTab con el importe/nro
// de operación.
async function searchPlainTextInActiveTab(terms) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    return { ok: false, message: "No hay una pestaña activa para buscar." };
  }

  const cleanTerms = (terms || []).filter(Boolean);
  if (cleanTerms.length === 0) {
    return { ok: false, message: "No hay texto para buscar." };
  }

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: (searchTerms) => {
      const normalizeText = (value) =>
        String(value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
          .replace(/\s+/g, " ")
          .trim();
      const bodyText = normalizeText(document.body ? document.body.innerText : "");
      const results = {};
      searchTerms.forEach((term) => {
        const normalized = normalizeText(term);
        results[term] = !!normalized && bodyText.includes(normalized);
      });
      return results;
    },
    args: [cleanTerms],
  });

  const merged = {};
  cleanTerms.forEach((term) => {
    merged[term] = false;
  });
  (frameResults || []).forEach((frame) => {
    const result = frame?.result;
    if (!result) return;
    Object.keys(result).forEach((key) => {
      if (result[key]) merged[key] = true;
    });
  });

  return { ok: true, results: merged };
}

async function searchInActiveTab(payload, searchType = "both") {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    return { ok: false, message: "No hay una pestaña activa para buscar." };
  }

  const searchTerms = buildSearchVariants(payload, searchType);
  if (searchTerms.length === 0) {
    return { ok: false, message: "No hay nro. operación ni importe para buscar." };
  }

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: (terms) => {
      const HIGHLIGHT_ATTR = "data-voucher-search-highlight";
      const HIGHLIGHT_CLASS = "__voucher_search_highlight__";

      const normalizeText = (value) =>
        String(value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

      const buildDigitIndexMap = (text) => {
        const positions = [];
        for (let index = 0; index < text.length; index += 1) {
          if (/\d/.test(text[index])) {
            positions.push(index);
          }
        }
        return positions;
      };

      const buildFlexibleDigitRegex = (digits) => {
        const safeDigits = String(digits || "").replace(/\D/g, "");
        if (!safeDigits) return null;
        return new RegExp(safeDigits.split("").map((digit) => `${digit}\\D*`).join(""), "i");
      };

      const normalizeMoneyText = (value) => {
        const text = String(value || "").trim();
        if (!text) return "";
        return text
          .replace(/[^\d,.-]/g, "")
          .replace(/(?<=\d),(?=\d{3}(\D|$))/g, "")
          .replace(/,/g, ".")
          .replace(/(\.\d{2})\d+$/, "$1");
      };

      const collectTableRows = () =>
        Array.from(document.querySelectorAll("tr")).map((row) => {
          const cells = Array.from(row.querySelectorAll("td, th")).map((cell) => ({
            text: String(cell.textContent || "").trim(),
            normalizedText: normalizeText(cell.textContent || ""),
            digits: normalizeDigits(cell.textContent || ""),
          }));

          return {
            row,
            text: normalizeText(row.textContent || ""),
            digits: normalizeDigits(row.textContent || ""),
            money: cells.map((cell) => normalizeMoneyText(cell.text)).filter(Boolean),
            cells,
          };
        });

      const cleanup = () => {
        document.querySelectorAll(`[${HIGHLIGHT_ATTR}="1"]`).forEach((node) => {
          const parent = node.parentNode;
          while (node.firstChild) {
            parent.insertBefore(node.firstChild, node);
          }
          parent.removeChild(node);
          parent.normalize();
        });
      };

      const clearPreviousHighlights = () => {
        document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
          const parent = el.parentNode;
          if (!parent) return;
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
          parent.normalize();
        });
      };

      const highlightTerm = (term) => {
        const normalizedTerm = normalizeText(term);
        const digitTerm = normalizeDigits(term);
        const digitRegex = buildFlexibleDigitRegex(digitTerm);
        const normalizedMoneyTerm = normalizeMoneyText(term);
        if (!normalizedTerm) return 0;

        clearPreviousHighlights();
        cleanup();

        const rows = collectTableRows();
        const matchingRows = rows.filter((entry) => {
          if (entry.text.includes(normalizedTerm)) return true;
          if (digitTerm && entry.digits.includes(digitTerm)) return true;
          if (normalizedMoneyTerm && entry.money.some((moneyValue) => moneyValue === normalizedMoneyTerm)) {
            return true;
          }
          return false;
        });

        if (matchingRows.length > 0) {
          const firstRow = matchingRows[0].row;
          firstRow.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          firstRow.style.outline = "3px solid #f59e0b";
          firstRow.style.background = "#fde68a";
          return matchingRows.length;
        }

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (parent.closest(`[${HIGHLIGHT_ATTR}="1"]`)) {
              return NodeFilter.FILTER_REJECT;
            }
            const text = normalizeText(node.textContent);
            if (!text) return NodeFilter.FILTER_REJECT;
            return text.includes(normalizedTerm) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          },
        });

        const nodes = [];
        let current = walker.nextNode();
        while (current) {
          nodes.push(current);
          current = walker.nextNode();
        }

        let matches = 0;
        let firstNode = null;

        nodes.forEach((node) => {
          const text = node.textContent || "";
          const normalizedNodeText = normalizeText(text);
          const digitNodeText = normalizeDigits(text);
          const exactMatch = normalizedNodeText.indexOf(normalizedTerm) >= 0;
          const digitMatch = !!digitTerm && digitNodeText.indexOf(digitTerm) >= 0;
          const flexibleDigitMatch = digitRegex ? digitRegex.exec(text) : null;

          let startOffset = text.toLowerCase().indexOf(String(term).toLowerCase());
          let endOffset = startOffset >= 0 ? startOffset + String(term).length : -1;

          if (startOffset < 0 && digitTerm) {
            const digitIndex = digitNodeText.indexOf(digitTerm);
            if (digitIndex >= 0) {
              const digitMap = buildDigitIndexMap(text);
              const startDigitPos = digitMap[digitIndex];
              const endDigitPos = digitMap[digitIndex + digitTerm.length - 1];
              if (startDigitPos !== undefined && endDigitPos !== undefined) {
                startOffset = startDigitPos;
                endOffset = endDigitPos + 1;
              }
            }
          }

          if (startOffset < 0 && flexibleDigitMatch) {
            startOffset = flexibleDigitMatch.index;
            endOffset = flexibleDigitMatch.index + flexibleDigitMatch[0].length;
          }

          if (!exactMatch && !digitMatch) return;
          if (startOffset < 0 || endOffset < 0) return;

          const range = document.createRange();
          range.setStart(node, startOffset);
          range.setEnd(node, endOffset);

          const mark = document.createElement("mark");
          mark.setAttribute(HIGHLIGHT_ATTR, "1");
          mark.className = HIGHLIGHT_CLASS;
          range.surroundContents(mark);
          matches += 1;
          if (!firstNode) {
            firstNode = mark;
          }
        });

        if (firstNode) {
          firstNode.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          firstNode.style.outline = "3px solid #f59e0b";
          firstNode.style.background = "#fde68a";
        }

        return matches;
      };

      for (const term of terms) {
        const matches = highlightTerm(term);
        if (matches > 0) {
          return { found: true, term, matches, frameUrl: window.location.href };
        }
      }

      clearPreviousHighlights();
      cleanup();
      return { found: false, term: "", matches: 0, frameUrl: window.location.href };
    },
    args: [searchTerms],
  });

  if (!frameResults?.length) {
    return { ok: false, message: "No se pudo ejecutar la búsqueda." };
  }

  const result =
    frameResults.find((entry) => entry?.result?.found)?.result || frameResults[0]?.result || null;

  if (!result) {
    return { ok: false, message: "No se pudo ejecutar la búsqueda." };
  }

  return {
    ok: true,
    found: !!result.found,
    term: result.term || "",
    matches: result.matches || 0,
    message: result.found ? "" : "No se encontró coincidencia.",
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (error) {
    console.warn("No se pudo configurar side panel:", error);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  if (chrome.sidePanel?.open) {
    // Chrome: comportamiento sin cambios.
    try {
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: "sidepanel.html",
        enabled: true,
      });
      await chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
    } catch (error) {
      console.warn("No se pudo abrir el panel lateral:", error);
    }
    return;
  }

  if (isFirefox) {
    // Firefox: sidebarAction.open() es el equivalente de sidePanel.open()
    // (no admite setOptions por pestaña -- el sidebar ya apunta siempre a
    // sidepanel.html via el manifest, "default_panel").
    try {
      await browser.sidebarAction.open();
    } catch (error) {
      console.warn("No se pudo abrir el sidebar (Firefox):", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "ADD_TO_QUEUE") {
    // IMPORTANTE: chrome.sidePanel.open() (y su equivalente Firefox,
    // browser.sidebarAction.open()) SOLO puede llamarse dentro del "user
    // gesture" del clic. Cualquier `await` previo (guardar en storage,
    // setOptions) rompe ese gesto y open() falla con "may only be called in
    // response to a user gesture". Por eso, cuando se pide abrir el panel
    // (openPanel: true, usado por el botón "Panel Lateral"), se llama PRIMERO
    // y de forma síncrona, y recién después se guarda el estado en la cola.
    let openPromise = null;
    if (message.openPanel && sender?.tab?.id) {
      if (chrome.sidePanel?.open) {
        // Chrome: sin cambios.
        try {
          openPromise = chrome.sidePanel.open({
            tabId: sender.tab.id,
            windowId: sender.tab.windowId,
          });
        } catch (error) {
          console.warn("No se pudo abrir el panel lateral (gesto):", error);
        }
      } else if (isFirefox) {
        try {
          openPromise = browser.sidebarAction.open();
        } catch (error) {
          console.warn("No se pudo abrir el sidebar (Firefox, gesto):", error);
        }
      }
    }

    (async () => {
      const state = await addToQueue({ id: message.id, depositData: message.depositData });

      if (sender?.tab?.id && chrome.sidePanel?.setOptions) {
        try {
          await chrome.sidePanel.setOptions({
            tabId: sender.tab.id,
            path: "sidepanel.html",
            enabled: true,
          });
        } catch (_error) {
          // ignorar
        }
      }

      let opened = false;
      if (openPromise) {
        try {
          await openPromise;
          opened = true;
        } catch (error) {
          console.warn("No se pudo abrir el panel lateral tras agregar a la cola:", error);
        }
      }

      sendResponse({ ok: true, state, opened });
    })().catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

    return true;
  }

  if (message.type === "REMOVE_FROM_QUEUE") {
    removeFromQueue({ id: message.id })
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "EDIT_QUEUE_ITEM_FIELDS") {
    updateQueueItemFields({ id: message.id, fields: message.fields })
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SEARCH_ANEXO_VALIDATION_IN_PAGE") {
    (async () => {
      const terms = [message.empresaValidar, message.datoValidar].filter(Boolean);
      const search = await searchPlainTextInActiveTab(terms);
      if (!search.ok) {
        sendResponse({ ok: false, message: search.message });
        return;
      }
      sendResponse({
        ok: true,
        empresaFound: !!search.results[message.empresaValidar],
        datoFound: !!search.results[message.datoValidar],
      });
    })().catch((error) => {
      sendResponse({ ok: false, message: error.message });
    });
    return true;
  }

  if (message.type === "SEARCH_VOUCHER_IN_PAGE") {
    (async () => {
      const result = await searchInActiveTab(message.depositData || {}, message.searchType || "both");
      sendResponse(result);
    })().catch((error) => {
      sendResponse({ ok: false, message: error.message });
    });
    return true;
  }

  return false;
});
