import React from "react";
import { Loader2 } from "lucide-react";
import { FALLBACK_VOUCHER_PREVIEW } from "../../deposits/components/depositDetailModalHelpers.jsx";

export const DepositVoucherPanel = ({
  displayVoucherUrl,
  deposit,
  setIsFloatingIframeOpen,
  isLoading = false
}) => {
  return (
    <div className="lg:col-span-6 flex flex-col h-full space-y-4">
                <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700 flex-1 min-h-0 flex flex-col relative overflow-hidden lg:overflow-auto">
                  <div
                    className="flex-1 min-h-0 flex items-center justify-center overflow-hidden lg:overflow-auto pointer-events-none lg:pointer-events-auto"
                    style={{ minHeight: "607px" }}
                  >
                    {isLoading ? (
                      // Mientras no llega el detalle completo (GET /v1/deposits/{id})
                      // no hay imagen real que mostrar todavia -- mejor un loader
                      // explicito que el recuadro gris vacio de antes, que se veia
                      // como si el voucher hubiera fallado en cargar.
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Cargando comprobante...
                        </span>
                      </div>
                    ) : displayVoucherUrl &&
                    (displayVoucherUrl.includes(".pdf") ||
                      displayVoucherUrl.includes("/preview")) ? (
                      <div
                        className="flex h-full w-full flex-col overflow-hidden rounded-md"
                        style={{
                          minHeight: "calc(93vh - 150px)",
                          height: "calc(93vh - 150px)",
                        }}
                      >
                        <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-t pointer-events-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              📄 PDF:
                            </span>

                            <button
                              onClick={() => setIsFloatingIframeOpen(true)}
                              className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                              title="Abrir iframe flotante"
                            >
                              🔍 Ventana Dedicada
                            </button>
                          </div>
                        </div>
                        <iframe
                          id="pdf-iframe-detail"
                          src={`${displayVoucherUrl}#toolbar=1&navpanes=1&scrollbar=1&view=Fit`}
                          className="w-full flex-1 pointer-events-none lg:pointer-events-auto"
                          title="Voucher"
                          style={{
                            border: "none",
                            minHeight: "calc(93vh - 200px)",
                            height: "calc(93vh - 200px)",
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-black/5 dark:bg-black/20">
                        <img
                          src={
                            displayVoucherUrl ||
                            FALLBACK_VOUCHER_PREVIEW
                          }
                          alt={`Voucher ${deposit.numero_voucher}`}
                          className="max-h-full max-w-full object-contain pointer-events-none lg:pointer-events-auto"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
  );
};
