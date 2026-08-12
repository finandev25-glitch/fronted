// ── Cola de depósitos: ÚNICO mecanismo de comunicación app → extensión ──────
// Tanto agregar varios depósitos desde el Kanban (openPanel ausente/false) como
// abrir uno solo con "Panel Lateral" en el detalle (openPanel: true, para que
// el side panel se abra de una) usan el mismo camino. Cuando openPanel es
// true, el CustomEvent síncrono es el que importa (conserva el "user gesture"
// del clic, necesario para que background.js pueda llamar
// chrome.sidePanel.open() sin que Chrome lo bloquee); el postMessage es solo
// respaldo para flujos que pudieran perder el gesto.

// Si la extensión se recarga/actualiza (típico durante desarrollo, al tocar
// "Recargar" en chrome://extensions) mientras esta pestaña ya tenía el
// content-script inyectado, chrome.runtime queda con un contexto invalidado:
// cualquier llamada a chrome.runtime.sendMessage tira "Extension context
// invalidated" de forma síncrona. No hay forma de recuperarlo desde acá (la
// única solución real es recargar la pestaña) -- esto solo evita que ese
// error, esperable, ensucie la consola/página de errores de la extensión.
function isExtensionContextValid() {
  try {
    return !!(chrome?.runtime && chrome.runtime.id);
  } catch (_error) {
    return false;
  }
}

function relayQueueAdd(id, depositData, openPanel) {
  if (!id || !isExtensionContextValid()) return;
  try {
    chrome.runtime.sendMessage({
      type: "ADD_TO_QUEUE",
      id,
      depositData: depositData || null,
      openPanel: !!openPanel,
    });
  } catch (_error) {
    // Contexto invalidado -- ver comentario más arriba.
  }
}

function relayQueueRemove(id) {
  if (!id || !isExtensionContextValid()) return;
  try {
    chrome.runtime.sendMessage({ type: "REMOVE_FROM_QUEUE", id });
  } catch (_error) {
    // Contexto invalidado -- ver comentario más arriba.
  }
}

window.addEventListener("confirmo:queue-add", (event) => {
  const detail = event?.detail || {};
  console.debug("confirmo:queue-add recibido en content script:", {
    id: detail.id,
    openPanel: !!detail.openPanel,
  });
  relayQueueAdd(detail.id, detail.depositData, detail.openPanel);
});

window.addEventListener("confirmo:queue-remove", (event) => {
  const detail = event?.detail || {};
  relayQueueRemove(detail.id);
});

// Respaldo: postMessage (asíncrono, puede perder el gesto en algunos casos).
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data) return;

  if (data.type === "QUEUE_ADD") {
    relayQueueAdd(data.id, data.depositData, data.openPanel);
  } else if (data.type === "QUEUE_REMOVE") {
    relayQueueRemove(data.id);
  }
});

// ── Canal de VUELTA extensión → página: cuando el usuario marca un depósito
// como "atendido" en el side panel (mientras navega la página del banco),
// eso se guarda en chrome.storage.local. Este content-script está inyectado
// también en la propia app CONFIRMO (ver host_permissions/content_scripts en
// manifest.json), así que puede escuchar chrome.storage.onChanged y reenviar
// el cambio hacia adentro de la página con un CustomEvent -- la app React lo
// escucha con window.addEventListener("confirmo:queue-updated", ...).
const QUEUE_STORAGE_KEY = "voucher_queue_state";

function dispatchQueueUpdated(items) {
  try {
    window.dispatchEvent(
      new CustomEvent("confirmo:queue-updated", { detail: { items: items || [] } }),
    );
  } catch (_error) {
    // ignorar en entornos sin CustomEvent
  }
}

if (isExtensionContextValid()) {
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[QUEUE_STORAGE_KEY]) return;
      dispatchQueueUpdated(changes[QUEUE_STORAGE_KEY].newValue?.items || []);
    });

    // Al cargar/recargar la página, sincroniza el estado actual de la cola
    // (si no se hiciera esto, la app no se entera de nada hasta el PRÓXIMO
    // cambio).
    chrome.storage.local
      .get(QUEUE_STORAGE_KEY)
      .then((result) => {
        dispatchQueueUpdated(result[QUEUE_STORAGE_KEY]?.items || []);
      })
      .catch(() => {
        // ignorar -- la app simplemente arranca con la cola vacía hasta el
        // próximo evento reactivo.
      });
  } catch (_error) {
    // Contexto invalidado -- ver comentario junto a isExtensionContextValid.
  }
}
