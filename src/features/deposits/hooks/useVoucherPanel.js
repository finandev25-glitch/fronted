import { useCallback, useState } from "react";

export function useVoucherPanel() {
  const [voucherPanelState, setVoucherPanelState] = useState({
    isOpen: false,
    voucherUrl: "",
    depositData: null,
  });

  // NOTA: "Panel Lateral" usa el MISMO mecanismo de cola que el botón
  // "Agregar a cola" del Kanban (ver useDepositQueue.js) -- así hay un solo
  // procedimiento tanto para un depósito suelto (la cola queda con 1 item)
  // como para varios. La única diferencia es openPanel: true, para que acá sí
  // se abra el side panel de una (el botón del Kanban no lo abre, para no
  // interrumpir mientras se triaje varios depósitos seguidos).
  const handleOpenVoucherWindow = useCallback((url, metadata = {}) => {
    if (!url) {
      alert("No hay un voucher para mostrar.");
      return;
    }

    // Se conserva por compatibilidad con VoucherExtensionPanel/
    // FloatingDepositMetaOverlay (solo se montan en el modo legado
    // ?ui=extension, no en el uso normal de la app) -- no afecta a la
    // extensión de Chrome real, que no lee este estado de React.
    setVoucherPanelState({
      isOpen: true,
      voucherUrl: url,
      depositData: metadata,
    });

    const id = metadata?.deposit_id;
    if (!id) {
      console.warn(
        "useVoucherPanel: falta deposit_id en metadata, no se pudo agregar el depósito a la cola de la extensión.",
      );
      return;
    }

    const depositData = { ...metadata, voucherUrl: url };

    // 1) CustomEvent SÍNCRONO: se despacha dentro del gesto del clic, así el
    //    content-script de AppExtension lo recibe con "user activation" viva y
    //    el background puede llamar chrome.sidePanel.open() sin que Chrome lo
    //    bloquee. (postMessage es asíncrono y pierde el gesto.)
    try {
      window.dispatchEvent(
        new CustomEvent("confirmo:queue-add", {
          detail: { id, depositData, openPanel: true },
        })
      );
    } catch (_error) {
      // ignorar en entornos sin CustomEvent
    }

    // 2) postMessage como respaldo (para flujos/listeners antiguos).
    window.postMessage(
      { type: "QUEUE_ADD", id, depositData, openPanel: true },
      "*"
    );
  }, []);

  const handleCloseVoucherPanel = useCallback(() => {
    setVoucherPanelState({
      isOpen: false,
      voucherUrl: "",
      depositData: null,
    });
  }, []);

  return {
    voucherPanelState,
    handleOpenVoucherWindow,
    handleCloseVoucherPanel,
  };
}

export default useVoucherPanel;
