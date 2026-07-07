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
