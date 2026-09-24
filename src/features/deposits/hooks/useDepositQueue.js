/**
 * useDepositQueue.js
 *
 * Espeja en React el depósito que está mostrando el side panel de
 * AppExtension (extensión de navegador). No hay backend ni store propio
 * involucrado: el estado real vive en chrome.storage.local, del lado de la
 * extensión (ver D:\fronted\AppExtension). Este hook expone acciones para
 * mostrar/quitar el depósito del panel, usando el mismo patrón de
 * comunicación que ya usa useVoucherPanel.js (CustomEvent síncrono +
 * postMessage de respaldo hacia el content-script de la extensión).
 *
 * Antes esto era una cola de VARIOS depósitos (se podían ir agregando desde
 * el Kanban sin abrir el panel, con un "atendido" por item para saber cuáles
 * ya estaban listos para confirmar). Ya no hace falta -- ahora solo existe
 * "Panel Lateral" desde el detalle de un depósito, y ese depósito reemplaza
 * al que estuviera mostrando el panel. `queueItems` internamente sigue
 * siendo un array (0 o 1 elementos) porque así lo modela también
 * AppExtension/background.js -- eso mantiene igual el resto de este hook
 * (los `.find()`/`.has()` de KanbanPage.jsx) sin tener que tocarlo.
 *
 * Canal de vuelta (extensión -> app): cuando el usuario edita un campo desde
 * el side panel, el content-script escucha chrome.storage.onChanged y
 * despacha un CustomEvent "confirmo:queue-updated" hacia la página con el
 * estado actualizado. Este hook escucha ese evento para mantenerse
 * sincronizado.
 *
 * Si la extensión no está instalada, addToQueue/removeFromQueue igual
 * actualizan el estado local (optimista) para que la UI responda, pero nunca
 * va a llegar un "confirmo:queue-updated" de vuelta -- inofensivo.
 *
 * Candado (lock/unlock) al mostrar/quitar del panel:
 * - addToQueue: si el depósito está "procesado" y libre, se toma el mismo
 *   candado que se tomaría al abrir el modal (onTakeDeposit / lockDeposit),
 *   ANTES de mandarlo al panel -- así otro usuario no puede tomarlo mientras
 *   se está viendo ahí. Si ya está tomado por otro usuario, no se muestra.
 * - Cuando el depósito sale del panel (por cualquier vía: "Quitar" en el
 *   side panel, o el propio removeFromQueue de la app, o reemplazado por
 *   otro) y sigue "procesado" y tomado por el usuario actual (no se
 *   confirmó ni rechazó), se libera el candado (onUnlockDeposit) para que
 *   otro usuario pueda tomarlo. onUnlockDeposit ya es un no-op seguro si el
 *   depósito cambió de estado (p. ej. se confirmó) o ya no es del usuario
 *   actual.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  getBancoOptions,
  getAnexoOptionsForDeposit,
  getCuentasBancariasForEmpresa,
} from "../utils/depositQueueCatalogHelpers";

function buildQueueDepositData(deposit, cuentas, bancos) {
  const voucherUrl =
    deposit?.imagen_voucher || deposit?.imagenUrl || deposit?.imagenVoucher || "";
  const currentBancoId = deposit?.banco?.id || deposit?.banco_id || "";

  return {
    fecha_deposito: deposit?.fecha_deposito || "",
    fechaDeposito: deposit?.fecha_deposito || "",
    // Único campo de operación en uso real (backend/BD trabajan solo con
    // NumeroOperacion) -- numero_operacion_banco ya no se manda, era un
    // vestigio de un sistema anterior. Se mantiene el nombre
    // "numero_operacion_solicitante" por compatibilidad con
    // DepositDetailModal.jsx (botón "Panel Lateral") y los componentes
    // legados VoucherExtensionPanel/FloatingDepositMetaOverlay.
    numero_operacion_solicitante: deposit?.numero_operacion || "",
    importe: deposit?.monto,
    moneda: deposit?.moneda || "",
    cliente: deposit?.cliente || "",
    anexo: deposit?.anexo || "",
    anexoOptions: getAnexoOptionsForDeposit(deposit, cuentas),
    // Tabla de cuentas bancarias (anexos) de la empresa, tal cual -- el side
    // panel la filtra por banco él mismo cada vez que el usuario cambia el
    // <select> de Banco (ver sidepanel.js, buildAnexoOptionsFromCuentas).
    cuentasBancarias: getCuentasBancariasForEmpresa(deposit, cuentas),
    bancoOptions: getBancoOptions(bancos),
    empresaId: deposit?.empresa?.id || deposit?.empresa_id || "",
    // Empresa como campo de solo lectura en el side panel (ver sidepanel.js).
    empresa: deposit?.empresa?.nombre || deposit?.empresa_nombre || "",
    bancoId: currentBancoId,
    estado: deposit?.estado,
    // Para el temporizador de 4 min en el side panel (ver sidepanel.js) --
    // mismo campo que usa el Kanban (utils/depositLockHelpers.js).
    fechaBloqueo: deposit?.fecha_bloqueo || null,
    sucursal: deposit?.sucursal?.nombre || "",
    banco: deposit?.banco?.abreviatura || deposit?.banco?.nombre || "",
    monto: deposit?.monto,
    deposit_id: deposit?.id,
    voucherUrl,
    // Resultado del chequeo cruzado OCR (Vision) vs. IA (LlamaCloud) -- ver
    // verificacionOcrHelpers.js para el shape y el origen real
    // (deposit.datos_ocr.verificacion). AppExtension lo usa para pintar
    // Moneda/Importe/Fecha igual que DepositDetailModal.jsx.
    verificacionOcr: deposit?.datos_ocr?.verificacion || null,
  };
}

export function useDepositQueue({
  deposits,
  cuentas,
  bancos,
  currentUser,
  onTakeDeposit,
  onUnlockDeposit,
} = {}) {
  const [queueItems, setQueueItems] = useState([]);

  // Referencias "en vivo" para leer el último valor dentro del listener de
  // confirmo:queue-updated sin tener que recrear ese efecto en cada render.
  const depositsRef = useRef(deposits);
  const currentUserRef = useRef(currentUser);
  const onUnlockDepositRef = useRef(onUnlockDeposit);
  const prevQueueItemsRef = useRef([]);

  useEffect(() => {
    depositsRef.current = deposits;
  }, [deposits]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    onUnlockDepositRef.current = onUnlockDeposit;
  }, [onUnlockDeposit]);

  useEffect(() => {
    const handleQueueUpdated = (event) => {
      const items = event?.detail?.items;
      if (!Array.isArray(items)) return;

      // Detecta ids que estaban en la cola y ya no -- sin importar si la
      // salida vino del propio removeFromQueue (abajo) o de "Quitar de la
      // cola" en el side panel de la extensión. Si ese depósito sigue
      // "procesado" y tomado por el usuario actual (no se confirmó ni
      // rechazó), se libera el candado para que otro usuario pueda tomarlo.
      const prevIds = new Set(prevQueueItemsRef.current.map((item) => item.id));
      const newIds = new Set(items.map((item) => item.id));
      const removedIds = [...prevIds].filter((id) => !newIds.has(id));

      prevQueueItemsRef.current = items;
      setQueueItems(items);

      if (removedIds.length === 0) return;
      const unlock = onUnlockDepositRef.current;
      const user = currentUserRef.current;
      if (!unlock || !user) return;

      removedIds.forEach((id) => {
        const deposit = (depositsRef.current || []).find((d) => d.id === id);
        if (
          deposit &&
          deposit.estado === "procesado" &&
          String(deposit.validado_por || "").toLowerCase() === String(user.id).toLowerCase()
        ) {
          void unlock(deposit);
        }
      });
    };

    window.addEventListener("confirmo:queue-updated", handleQueueUpdated);
    return () => window.removeEventListener("confirmo:queue-updated", handleQueueUpdated);
  }, []);

  const addToQueue = useCallback(
    async (deposit) => {
      if (!deposit?.id) return;

      let depositForQueue = deposit;

      // Mismo candado que se toma al abrir el modal (ver KanbanPage
      // handleCardClick): si está pendiente y libre, se toma ANTES de
      // encolar, para que nadie más pueda tomarlo mientras espera en la
      // cola. Si onTakeDeposit no puede tomarlo (ya lo tomó otro usuario
      // justo antes), no se agrega.
      if (deposit.estado === "procesado" && !deposit.validado_por && currentUser && onTakeDeposit) {
        const locked = await onTakeDeposit(deposit);
        if (!locked) return;
        depositForQueue = locked;
      } else if (
        deposit.validado_por &&
        currentUser &&
        String(deposit.validado_por).toLowerCase() !== String(currentUser.id).toLowerCase()
      ) {
        alert("Este depósito ya está siendo validado por otro usuario.");
        return;
      }

      const depositData = buildQueueDepositData(depositForQueue, cuentas, bancos);

      // Reemplaza lo que hubiera antes -- ya no se acumula (ver comentario
      // del archivo). A propósito NO se toca prevQueueItemsRef acá (a
      // diferencia de removeFromQueue más abajo): tiene que seguir apuntando
      // al último estado CONFIRMADO por la extensión, para que cuando llegue
      // el confirmo:queue-updated real de este reemplazo, el diff de más
      // arriba compare contra el item anterior de verdad y detecte que
      // "salió" de la cola -- así se libera su candado si correspondía. Si
      // acá también se actualizara el ref de forma optimista, ese diff
      // nunca vería la salida del item anterior y su candado quedaría sin
      // liberar hasta que expire solo.
      setQueueItems([
        {
          id: depositForQueue.id,
          depositData,
          addedAt: new Date().toISOString(),
        },
      ]);

      // 1) CustomEvent síncrono (mismo patrón que useVoucherPanel.js).
      try {
        window.dispatchEvent(
          new CustomEvent("confirmo:queue-add", {
            detail: { id: depositForQueue.id, depositData },
          }),
        );
      } catch (_error) {
        // ignorar en entornos sin CustomEvent
      }

      // 2) postMessage como respaldo.
      window.postMessage(
        { type: "QUEUE_ADD", id: depositForQueue.id, depositData },
        "*",
      );
    },
    [cuentas, bancos, currentUser, onTakeDeposit],
  );

  const removeFromQueue = useCallback((depositId) => {
    if (!depositId) return;

    setQueueItems((prev) => {
      const next = prev.filter((item) => item.id !== depositId);
      prevQueueItemsRef.current = next;
      return next;
    });

    try {
      window.dispatchEvent(
        new CustomEvent("confirmo:queue-remove", { detail: { id: depositId } }),
      );
    } catch (_error) {
      // ignorar en entornos sin CustomEvent
    }

    window.postMessage({ type: "QUEUE_REMOVE", id: depositId }, "*");
  }, []);

  const queuedIds = useMemo(
    () => new Set(queueItems.map((item) => item.id)),
    [queueItems],
  );

  return {
    queueItems,
    queuedIds,
    addToQueue,
    removeFromQueue,
  };
}

export default useDepositQueue;
