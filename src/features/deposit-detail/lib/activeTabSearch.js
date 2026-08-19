// Dispara la búsqueda del importe / nro. operación en la PESTAÑA ACTIVA.
// El trabajo real (chrome.scripting sobre la pestaña + iframes) lo hace un
// SERVICE WORKER de extensión; aquí solo se le manda un mensaje. Se hace así
// —y no con chrome.scripting directo desde acá— porque el background
// resuelve de forma confiable la pestaña activa.
//
// Dos formas de llegar a ese background, según dónde corra este código:
//
// 1) Adentro de una extensión (chrome.runtime.id definido: ExtensionPanelPrueba
//    cargada como side panel, o AppExtension) -- mensaje "interno" normal,
//    chrome.runtime.sendMessage(mensaje), el propio background.js de esa
//    extensión ya escucha con chrome.runtime.onMessage.
// 2) Como sitio web normal (portal.tyresperu.com, chrome.runtime.id NO
//    definido) -- acá no hay chrome.scripting disponible directamente (una
//    página https:// normal nunca lo tiene, sin importar permisos). Lo que
//    SÍ puede pasar es que el usuario tenga instalada la extensión
//    "PortalPanelExtension" (ver /PortalPanelExtension en el repo), que
//    declara "externally_connectable" para este dominio -- eso hace que
//    Chrome exponga un chrome.runtime limitado en esta página, con el que
//    se le puede mandar un mensaje a ESA extensión por su ID fijo
//    (chrome.runtime.sendMessage(EXTENSION_ID, mensaje)). Si esa extensión
//    no está instalada, chrome.runtime.sendMessage simplemente no existe acá
//    y isActiveTabSearchAvailable() da false.

// ID fijo de PortalPanelExtension (se deriva de la clave "key" en su
// manifest.json, que es justamente lo que lo mantiene estable entre
// instalaciones -- si se regenera esa key desde cero, hay que actualizar
// este valor).
const PORTAL_PANEL_EXTENSION_ID = "dfihghjmaibgnbdadjnnmpadfhaocnaa";

function hasChromeRuntime() {
  return typeof chrome !== "undefined" && Boolean(chrome?.runtime?.sendMessage);
}

export function isActiveTabSearchAvailable() {
  return hasChromeRuntime();
}

// Envuelve chrome.runtime.sendMessage (que en MV3 admite forma con promesa
// solo para el canal interno) en una Promise común para ambos canales, y
// resuelve null en vez de tirar cuando no hay nadie escuchando del otro lado
// (chrome.runtime.lastError) -- típicamente "la extensión no está instalada".
function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    const callback = (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    };

    if (chrome.runtime.id) {
      chrome.runtime.sendMessage(message, callback);
    } else {
      chrome.runtime.sendMessage(PORTAL_PANEL_EXTENSION_ID, message, callback);
    }
  });
}

export async function searchActiveTab(terms) {
  if (!isActiveTabSearchAvailable()) {
    return {
      ok: false,
      available: false,
      found: false,
      message:
        "La búsqueda en la pantalla necesita la extensión de Confirmo instalada (con permiso para este sitio).",
    };
  }

  const list = (terms || [])
    .map((t) => String(t ?? "").trim())
    .filter(Boolean);
  if (list.length === 0) {
    return { ok: false, available: true, found: false, message: "No hay valor para buscar." };
  }

  const res = await sendRuntimeMessage({ type: "SEARCH_VOUCHER_IN_PAGE", terms: list });

  if (!res) {
    return {
      ok: false,
      available: true,
      found: false,
      message: "No se pudo conectar con la extensión (¿sigue instalada y habilitada?).",
    };
  }

  return { available: true, ...res };
}

export default searchActiveTab;
