// Service worker de la extensión Confirmo.
//  - Abre el panel lateral al clic del icono.
//  - Ejecuta la búsqueda del importe / nro. operación en la PESTAÑA ACTIVA
//    (incluidos sus iframes) cuando el panel lo pide por mensaje. Se hace desde
//    el background (no desde el panel) porque es el contexto que resuelve de
//    forma confiable la pestaña activa.

chrome.sidePanel
  ?.setPanelBehavior?.({ openPanelOnActionClick: true })
  .catch((error) =>
    console.error("No se pudo configurar el side panel de Confirmo:", error),
  );

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SEARCH_VOUCHER_IN_PAGE") {
    searchInActiveTab(message.terms || [])
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ ok: false, found: false, message: error?.message || "Error de búsqueda" }),
      );
    return true; // respuesta asíncrona
  }
  return false;
});

async function searchInActiveTab(terms) {
  const list = (terms || []).map((t) => String(t ?? "").trim()).filter(Boolean);
  if (list.length === 0) {
    return { ok: false, found: false, message: "No hay valor para buscar." };
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    return { ok: false, found: false, message: "No hay una pestaña activa para buscar." };
  }

  console.log("[busqueda-bg] pestaña activa:", tab.url, "| términos:", list);

  let frameResults;
  try {
    frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      args: [list],
      func: injectedSearch,
    });
  } catch (error) {
    console.warn("[busqueda-bg] executeScript falló:", error);
    return {
      ok: false,
      found: false,
      message: `No se pudo buscar en esta pestaña: ${error?.message || error}`,
    };
  }

  console.log(
    "[busqueda-bg] frames inyectados:",
    frameResults.length,
    frameResults.map((f) => ({
      frame: f?.result?.frameUrl,
      found: f?.result?.found,
      matches: f?.result?.matches,
    })),
  );

  const result =
    frameResults.find((entry) => entry?.result?.found)?.result ||
    frameResults[0]?.result || { found: false };

  return { ok: true, ...result };
}

// Se serializa e inyecta en cada frame de la pestaña: debe ser autónoma.
function injectedSearch(terms) {
  const HIGHLIGHT_ATTR = "data-voucher-search-highlight";
  const HIGHLIGHT_CLASS = "__voucher_search_highlight__";

  const normalizeText = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

  const flexibleDigitRegex = (digits) => {
    const safe = onlyDigits(digits);
    if (!safe) return null;
    return new RegExp(safe.split("").map((d) => `${d}\\D*`).join(""), "i");
  };

  const normalizeMoney = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return text
      .replace(/[^\d,.-]/g, "")
      .replace(/(?<=\d),(?=\d{3}(\D|$))/g, "")
      .replace(/(?<=\d)\.(?=\d{3}(\D|$))/g, "")
      .replace(/,/g, ".")
      .replace(/(\.\d{2})\d+$/, "$1");
  };

  const digitOffsets = (text) => {
    const positions = [];
    for (let i = 0; i < text.length; i += 1) {
      if (/\d/.test(text[i])) positions.push(i);
    }
    return positions;
  };

  const cleanup = () => {
    document.querySelectorAll(`[${HIGHLIGHT_ATTR}="1"]`).forEach((node) => {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      parent.normalize();
    });
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      parent.normalize();
    });
  };

  const emphasize = (node) => {
    node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    node.style.outline = "3px solid #f59e0b";
    node.style.background = "#fde68a";
  };

  const matchInTableRows = (term) => {
    const normTerm = normalizeText(term);
    const digitTerm = onlyDigits(term);
    const moneyTerm = normalizeMoney(term);
    const rows = Array.from(document.querySelectorAll("tr"));
    for (const row of rows) {
      const rowText = normalizeText(row.textContent || "");
      const rowDigits = onlyDigits(row.textContent || "");
      const cellsMoney = Array.from(row.querySelectorAll("td, th"))
        .map((c) => normalizeMoney(c.textContent || ""))
        .filter(Boolean);
      const hit =
        (normTerm && rowText.includes(normTerm)) ||
        (digitTerm && rowDigits.includes(digitTerm)) ||
        (moneyTerm && cellsMoney.some((m) => m === moneyTerm));
      if (hit) {
        emphasize(row);
        return 1;
      }
    }
    return 0;
  };

  const matchInTextNodes = (term) => {
    const normTerm = normalizeText(term);
    const digitTerm = onlyDigits(term);
    const digitRegex = flexibleDigitRegex(digitTerm);
    if (!normTerm) return 0;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        const t = normalizeText(node.textContent);
        if (!t) return NodeFilter.FILTER_REJECT;
        const okText = t.includes(normTerm);
        const okDigits = digitTerm && onlyDigits(node.textContent).includes(digitTerm);
        const okFlexible = digitRegex ? digitRegex.test(node.textContent || "") : false;
        return okText || okDigits || okFlexible
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
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
      let start = text.toLowerCase().indexOf(String(term).toLowerCase());
      let end = start >= 0 ? start + String(term).length : -1;

      if (start < 0 && digitTerm) {
        const idx = onlyDigits(text).indexOf(digitTerm);
        if (idx >= 0) {
          const map = digitOffsets(text);
          const s = map[idx];
          const e = map[idx + digitTerm.length - 1];
          if (s !== undefined && e !== undefined) {
            start = s;
            end = e + 1;
          }
        }
      }

      if (start < 0 && digitRegex) {
        const m = digitRegex.exec(text);
        if (m) {
          start = m.index;
          end = m.index + m[0].length;
        }
      }

      if (start < 0 || end < 0) return;

      try {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        const mark = document.createElement("mark");
        mark.setAttribute(HIGHLIGHT_ATTR, "1");
        mark.className = HIGHLIGHT_CLASS;
        range.surroundContents(mark);
        matches += 1;
        if (!firstNode) firstNode = mark;
      } catch {
        // rango cruza límites de elementos: se ignora ese nodo
      }
    });

    if (firstNode) emphasize(firstNode);
    return matches;
  };

  cleanup();

  for (const term of terms) {
    const rowMatches = matchInTableRows(term);
    if (rowMatches > 0) {
      return { found: true, term, matches: rowMatches, frameUrl: window.location.href };
    }
    const textMatches = matchInTextNodes(term);
    if (textMatches > 0) {
      return { found: true, term, matches: textMatches, frameUrl: window.location.href };
    }
    cleanup();
  }

  return { found: false, term: "", matches: 0, frameUrl: window.location.href };
}
