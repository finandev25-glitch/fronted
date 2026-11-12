// Preferencia "Abrir el siguiente pendiente al terminar" (por navegador).
// La casilla vive en el detalle del depósito (DepositDetailModal) y quien
// la aplica es el Kanban (KanbanPage) al cerrarse el detalle tras
// confirmar o rechazar.

const KEY = "confirmo-auto-next-pending";

export function getAutoNextPreference() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoNextPreference(enabled) {
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    // localStorage no disponible: la casilla vuelve a desmarcarse al recargar.
  }
}
