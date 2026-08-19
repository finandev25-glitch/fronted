/**
 * useDepositLockTimer.js
 *
 * Libera PROACTIVAMENTE, del lado del cliente, cualquier depósito que el
 * usuario actual tenga tomado ("procesado" + validado_por === yo) hace más
 * de 4 minutos sin confirmar ni rechazar -- así se ve disponible para otros
 * usuarios de inmediato, en vez de recién liberarse cuando alguien más
 * intenta tomarlo (ver DEPOSIT_LOCK_TTL_MS / FechaBloqueo en el backend,
 * que es el respaldo real por si la pestaña se cierra antes de los 4 min).
 *
 * Si el depósito estaba en la cola de la extensión, también se saca de ahí
 * (removeFromQueue) -- si no, se quedaba "fantasma" en el side panel con un
 * candado que ya no es tuyo. Nótese que esto es aparte del round-trip que ya
 * maneja useDepositQueue.js para cuando el usuario saca algo manualmente
 * ("Quitar de la cola" en el side panel): acá la salida la inicia el propio
 * temporizador, así que hay que pedir el unlock Y la salida de la cola a
 * mano, las dos.
 */
import { useEffect, useRef } from "react";
import { getDepositLockRemainingMs } from "../../../utils/depositLockHelpers";

const CHECK_INTERVAL_MS = 10_000;

export function useDepositLockTimer({
  deposits,
  currentUser,
  onUnlockDeposit,
  removeFromQueue,
  // Se llama con el depósito recién auto-liberado -- KanbanPage lo usa para
  // cerrar el modal de detalle si justo era el que estaba abierto (antes se
  // quedaba abierto mostrando un depósito que ya volvió a "Pendiente" y que
  // cualquier otro usuario puede tomar; más notorio en el panel compacto/
  // extensión, que se queda "colgado" mostrando el formulario de un
  // depósito que ya no es tuyo).
  onDepositUnlocked,
}) {
  // Evita reintentar el unlock en cada tick mientras esperamos que la
  // confirmación del backend se refleje en `deposits` (que puede tardar un
  // instante vía websocket/refetch).
  const autoUnlockedIdsRef = useRef(new Set());

  useEffect(() => {
    if (!currentUser || !onUnlockDeposit) return undefined;

    const tick = () => {
      const mine = (deposits || []).filter(
        (d) =>
          d.estado === "procesado" &&
          String(d.validado_por || "").toLowerCase() === String(currentUser.id).toLowerCase(),
      );
      if (mine.length > 0) {
        console.debug(
          "[lock-timer] depósitos tomados por mí:",
          mine.map((d) => ({
            id: d.id,
            fecha_bloqueo: d.fecha_bloqueo,
            remainingMs: getDepositLockRemainingMs(d),
          })),
        );
      }

      (deposits || []).forEach((deposit) => {
        if (
          deposit.estado !== "procesado" ||
          String(deposit.validado_por || "").toLowerCase() !==
            String(currentUser.id).toLowerCase()
        ) {
          return;
        }

        const remaining = getDepositLockRemainingMs(deposit);
        if (
          remaining !== null &&
          remaining <= 0 &&
          !autoUnlockedIdsRef.current.has(deposit.id)
        ) {
          console.debug("[lock-timer] auto-liberando depósito vencido:", deposit.id);
          autoUnlockedIdsRef.current.add(deposit.id);
          void onUnlockDeposit(deposit);
          removeFromQueue?.(deposit.id);
          onDepositUnlocked?.(deposit);
        }
      });
    };

    tick();
    const intervalId = setInterval(tick, CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [deposits, currentUser, onUnlockDeposit, removeFromQueue, onDepositUnlocked]);

  // Si el depósito deja de estar tomado por mí (se liberó, lo confirmé, o lo
  // volví a tomar más tarde), se limpia la marca para que un futuro
  // vencimiento se pueda volver a auto-liberar.
  useEffect(() => {
    const stillMine = new Set(
      (deposits || [])
        .filter(
          (d) =>
            currentUser &&
            String(d.validado_por || "").toLowerCase() ===
              String(currentUser.id).toLowerCase(),
        )
        .map((d) => d.id),
    );

    autoUnlockedIdsRef.current.forEach((id) => {
      if (!stillMine.has(id)) autoUnlockedIdsRef.current.delete(id);
    });
  }, [deposits, currentUser]);
}

export default useDepositLockTimer;
