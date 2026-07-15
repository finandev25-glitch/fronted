import { useRef, useState } from "react";
import { Globe, X, ArrowRight, RotateCw, ExternalLink } from "lucide-react";

// URL inicial. google.com normal envía X-Frame-Options: SAMEORIGIN y no se
// puede embeber; el parámetro igu=1 entrega el buscador SIN esa cabecera.
const DEFAULT_URL = "https://www.google.com/webhp?igu=1";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 448;

function clampWidth(px) {
  const max = typeof window !== "undefined" ? window.innerWidth * 0.95 : 900;
  return Math.min(Math.max(px, MIN_WIDTH), max);
}

// Normaliza lo que escribe el usuario: si no trae protocolo, le antepone https.
function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function WebFramePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState(DEFAULT_URL); // URL cargada en el iframe
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL); // texto del campo
  const [frameKey, setFrameKey] = useState(0); // fuerza recarga del iframe
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? clampWidth(DEFAULT_WIDTH) : DEFAULT_WIDTH
  );
  const [isResizing, setIsResizing] = useState(false);

  const draggingRef = useRef(false);

  const loadUrl = () => {
    const normalized = normalizeUrl(inputUrl);
    if (!normalized) return;
    setInputUrl(normalized);
    setUrl(normalized);
    setFrameKey((k) => k + 1);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadUrl();
    }
  };

  // Para sitios que bloquean el iframe (bancos/WAF), abrir en pestaña real.
  const openInNewTab = () => {
    const target = normalizeUrl(inputUrl) || url;
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };

  // Arrastrar el borde izquierdo para cambiar el ancho del panel.
  const startResize = (event) => {
    event.preventDefault();
    draggingRef.current = true;
    setIsResizing(true);
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      if (!draggingRef.current) return;
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      setWidth(clampWidth(window.innerWidth - clientX));
    };
    const onUp = () => {
      draggingRef.current = false;
      setIsResizing(false);
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  return (
    <>
      {/* Botón flotante para abrir/cerrar el panel */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? "Cerrar panel web" : "Abrir panel web"}
        aria-label={isOpen ? "Cerrar panel web" : "Abrir panel web"}
        className="fixed bottom-24 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {isOpen ? <X size={20} /> : <Globe size={20} />}
      </button>

      {/* Backdrop (solo en pantallas chicas) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel lateral deslizante y redimensionable */}
      <aside
        style={{ width: `${width}px` }}
        className={`fixed right-0 top-0 z-40 flex h-full max-w-[95vw] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 ${
          isResizing ? "" : "transition-transform duration-300"
        } ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!isOpen}
      >
        {/* Manija de redimensionado (borde izquierdo) */}
        <div
          onMouseDown={startResize}
          onTouchStart={startResize}
          title="Arrastra para cambiar el ancho"
          className="group absolute left-0 top-0 z-10 flex h-full w-2 -translate-x-1/2 cursor-col-resize items-center justify-center"
        >
          <div
            className={`h-full w-1 transition-colors ${
              isResizing ? "bg-blue-500" : "bg-transparent group-hover:bg-blue-400/60"
            }`}
          />
        </div>

        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
            <Globe size={18} className="text-blue-600 dark:text-blue-400" />
            Panel web
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title="Cerrar"
            aria-label="Cerrar panel"
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de dirección: pega/cambia la URL aquí */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <input
            type="url"
            value={inputUrl}
            onChange={(event) => setInputUrl(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://ejemplo.com"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={loadUrl}
            title="Cargar URL"
            aria-label="Cargar URL"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700"
          >
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setFrameKey((k) => k + 1)}
            title="Recargar"
            aria-label="Recargar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RotateCw size={15} />
          </button>
          <button
            type="button"
            onClick={openInNewTab}
            title="Abrir en pestaña nueva (para sitios que bloquean el iframe)"
            aria-label="Abrir en pestaña nueva"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ExternalLink size={15} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {/* Mientras se arrastra, una capa transparente evita que el iframe
              "trague" los eventos del mouse y se corte el redimensionado. */}
          {isResizing && <div className="absolute inset-0 z-10" />}
          {/* El iframe se monta solo cuando el panel está abierto. */}
          {isOpen && (
            <iframe
              key={frameKey}
              src={url}
              title="Panel web"
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        <p className="border-t border-gray-200 px-3 py-2 text-[11px] leading-tight text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Nota: algunos sitios (Google, bancos, etc.) bloquean ser incrustados y
          se verán en blanco.
        </p>
      </aside>
    </>
  );
}

export default WebFramePanel;
