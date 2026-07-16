import { useCallback, useState } from "react";

export function useVoucherPanel() {
  const [voucherPanelState, setVoucherPanelState] = useState({
    isOpen: false,
    voucherUrl: "",
    depositData: null,
  });

  const handleOpenVoucherWindow = useCallback((url, metadata = {}) => {
    if (!url) {
      alert("No hay un voucher para mostrar.");
      return;
    }

    setVoucherPanelState({
      isOpen: true,
      voucherUrl: url,
      depositData: metadata,
    });

    // 1) CustomEvent SÍNCRONO: se despacha dentro del gesto del clic, así el
    //    content-script de AppExtension lo recibe con "user activation" viva y
    //    el background puede llamar chrome.sidePanel.open() sin que Chrome lo
    //    bloquee. (postMessage es asíncrono y pierde el gesto.)
    try {
      window.dispatchEvent(
        new CustomEvent("confirmo:load-voucher", {
          detail: { url, depositData: metadata },
        })
      );
    } catch (_error) {
      // ignorar en entornos sin CustomEvent
    }

    // 2) postMessage como respaldo (para flujos/listeners antiguos).
    window.postMessage(
      {
        type: "LOAD_VOUCHER",
        url,
        depositData: metadata,
      },
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
