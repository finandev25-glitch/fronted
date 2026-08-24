import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// Toast liviano sin dependencias externas (evita instalar una librería nueva
// -- ver conversación sobre el riesgo de tocar node_modules, que en este
// proyecto está compilado para Windows). Uso: const toast = useToast();
// toast.success("..."), toast.error("..."), toast.info("...").
const ToastContext = createContext(null);

const TOAST_STYLES = {
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200",
  error:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/90 dark:text-red-200",
  info:
    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/90 dark:text-blue-200",
};

let toastIdSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message, { type = "info", duration = 4500 } = {}) => {
      const id = ++toastIdSeq;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => dismissToast(id), duration);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismissToast],
  );

  const toast = useMemo(
    () => ({
      show: showToast,
      success: (message, opts) => showToast(message, { ...opts, type: "success" }),
      error: (message, opts) => showToast(message, { ...opts, type: "error" }),
      info: (message, opts) => showToast(message, { ...opts, type: "info" }),
      dismiss: dismissToast,
    }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
              TOAST_STYLES[item.type] || TOAST_STYLES.info
            }`}
          >
            <p className="flex-1 text-sm font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="shrink-0 text-current opacity-60 transition-opacity hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

export default ToastProvider;
