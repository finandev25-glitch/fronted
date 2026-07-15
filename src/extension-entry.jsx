window.__APP_UI_MODE__ = "extension";
window.__API_BASE_URL__ =
  import.meta.env.VITE_API_BASE_URL || "http://192.168.85.50:3000";

// En la extensión no existe el proxy "/hubs" de Vite, así que el hub de SignalR
// necesita URL ABSOLUTA (si no, "realtime" no conecta). Se deriva del backend.
window.__SIGNALR_HUB_URL__ =
  import.meta.env.VITE_SIGNALR_HUB_URL ||
  `${window.__API_BASE_URL__}/hubs/deposits`;

import("./main.jsx");
