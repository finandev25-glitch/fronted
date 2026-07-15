// Dispara la búsqueda del importe / nro. operación en la PESTAÑA ACTIVA.
// El trabajo real (chrome.scripting sobre la pestaña + iframes) lo hace el
// SERVICE WORKER de la extensión (public/background.js); aquí solo se le manda
// un mensaje. Se hace así —y no con chrome.scripting directo desde el panel—
// porque el background resuelve de forma confiable la pestaña activa.

export function isActiveTabSearchAvailable() {
  // chrome.runtime.id solo está definido dentro de una extensión.
  return Boolean(
    typeof chrome !== "undefined" &&
      chrome?.runtime?.id &&
      chrome?.runtime?.sendMessage,
  );
}

export async function searchActiveTab(terms) {
  if (!isActiveTabSearchAvailable()) {
    return {
      ok: false,
      available: false,
      found: false,
      message: "La búsqueda en la pantalla solo está disponible en la extensión.",
    };
  }

  const list = (terms || [])
    .map((t) => String(t ?? "").trim())
    .filter(Boolean);
  if (list.length === 0) {
    return { ok: false, available: true, found: false, message: "No hay valor para buscar." };
  }

  const res = await chrome.runtime.sendMessage({
    type: "SEARCH_VOUCHER_IN_PAGE",
    terms: list,
  });

  if (!res) {
    return { ok: false, available: true, found: false, message: "Sin respuesta del background." };
  }

  return { available: true, ...res };
}

export default searchActiveTab;
