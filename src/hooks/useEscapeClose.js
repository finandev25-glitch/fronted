import { useEffect } from "react";

// Pila global de modales que tienen el listener de Escape activo. Se usa
// para que, si hay modales anidados (ej. AvisoGaleriaPicker abierto encima
// de AvisoFormModal), la tecla Escape cierre SOLO el que esta mas arriba
// (el montado mas reciente) en vez de cerrar los dos de un tiron -- los
// listeners de "keydown" en document se disparan todos para el mismo
// evento sin importar cual esta "encima" visualmente, asi que sin esta
// pila un solo Esc cerraria el modal padre y el hijo al mismo tiempo.
let modalStack = [];

// Hook compartido para cerrar un modal con la tecla Escape. Ningun modal de
// la app lo tenia implementado (ver auditoria UX) -- DepositDetailModal
// incluso mostraba "Esc: cerrar" en su footer sin que la funcionalidad
// existiera. Uso: useEscapeClose(onClose) dentro de cualquier componente de
// modal, pasando la misma funcion que ya usa el boton de cerrar/cancelar.
//
// `enabled` permite desactivar el listener condicionalmente (por ejemplo,
// si el modal tiene su propio submit en curso y no queres que Esc lo corte).
export function useEscapeClose(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof onClose !== "function") return undefined;

    const id = Symbol("escapeModal");
    modalStack.push(id);

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (modalStack[modalStack.length - 1] === id) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      modalStack = modalStack.filter((item) => item !== id);
    };
  }, [onClose, enabled]);
}

export default useEscapeClose;
