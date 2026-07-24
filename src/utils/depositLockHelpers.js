/**
 * depositLockHelpers.js
 *
 * Candado con vencimiento de 4 minutos.
 *
 * El respaldo real vive en el backend (api-bridge): si pasaron más de 4
 * minutos desde que alguien tomó un depósito ("procesado" + validado_por) y
 * nunca lo confirmó/rechazó, el candado se considera abandonado y el
 * endpoint POST /{id}/lock lo reasigna sin más al primer usuario que lo pida
 * (ver FechaBloqueo en Deposito.cs). Esto es lo que garantiza que el
 * depósito realmente se libere aunque el usuario que lo tenía haya cerrado
 * la pestaña.
 *
 * Este helper solo centraliza el cálculo del tiempo restante para MOSTRARLO
 * (Kanban vía DepositCard, y el panel lateral de la extensión vía
 * depositData.fechaBloqueo vieron useDepositQueue.js) y para liberarlo
 * PROACTIVAMENTE del lado del cliente apenas se cumplen los 4 minutos
 * mientras la pestaña sigue abierta (useDepositLockTimer.js) -- así el
 * depósito se ve disponible para otros de inmediato, no recién cuando
 * alguien más intenta tomarlo.
 */

export const DEPOSIT_LOCK_TTL_MS = 4 * 60 * 1000;

// deposit.fecha_bloqueo viene mapeado desde item.fechaBloqueo en
// depositsApi.js (mapDeposit) -- ver también el seteo optimista en
// useDepositRecords.js (handleTakeDepositForValidation/handleUnlockDeposit).
export function getDepositLockRemainingMs(deposit) {
  const takenAtRaw = deposit?.fecha_bloqueo;
  if (!takenAtRaw) return null;

  const takenAt = new Date(takenAtRaw).getTime();
  if (Number.isNaN(takenAt)) return null;

  return Math.max(0, DEPOSIT_LOCK_TTL_MS - (Date.now() - takenAt));
}

export function formatLockRemaining(ms) {
  if (ms === null || ms === undefined) return "";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default {
  DEPOSIT_LOCK_TTL_MS,
  getDepositLockRemainingMs,
  formatLockRemaining,
};
