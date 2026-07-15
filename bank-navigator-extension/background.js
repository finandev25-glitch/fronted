// Abre el panel lateral al hacer clic en el icono de la extensión.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("No se pudo configurar el side panel:", error));
