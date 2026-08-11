import React from "react";
import { RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

// Imagen de voucher con zoom (rueda del mouse, doble click, botones +/-) y
// pan (arrastrar con el mouse) cuando está ampliada. Compartido entre el
// panel principal del detalle de depósito (DepositVoucherPanel) y el modal
// de Consulta SQL Server (DepositDetailModal) -- ambos muestran el mismo
// voucher y necesitaban la misma interacción, así que vive acá una sola vez
// en vez de reimplementarse en cada lugar.
//
// `resetKey` reinicia rotación/zoom/pan cuando cambia (normalmente la URL
// del voucher que se está mostrando).
const ZoomableVoucherImage = ({
  src,
  alt,
  resetKey,
  showRotate = true,
  imgClassName = "",
  imgStyle = {},
  onError,
}) => {
  const [rotation, setRotation] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStateRef = React.useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [resetKey]);

  const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const applyZoom = (nextZoom) => {
    const clamped = clampZoom(nextZoom);
    setZoom(clamped);
    // Si vuelve a 1x, no dejar un desplazamiento residual -- la imagen ya
    // vuelve a estar contenida entera, centrada.
    if (clamped === MIN_ZOOM) setPan({ x: 0, y: 0 });
  };

  // Rueda del mouse: preventDefault real (el onWheel sintético de React es
  // pasivo por default y no bloquea el scroll de la página) -- por eso se
  // engancha con un listener nativo { passive: false }.
  React.useEffect(() => {
    const node = wrapRef.current;
    if (!node || !src) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((prev) => {
        const next = clampZoom(prev + delta);
        if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return next;
      });
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [src]);

  const handleDoubleClick = () => {
    if (!src) return;
    applyZoom(zoom > MIN_ZOOM ? MIN_ZOOM : 2.5);
  };

  const handleMouseDown = (e) => {
    if (zoom <= MIN_ZOOM) return;
    setIsDragging(true);
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, panX, panY } = dragStateRef.current;
    setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) });
  };

  const stopDragging = () => setIsDragging(false);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
    >
      {src && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 pointer-events-auto">
          {showRotate && (
            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow hover:bg-white dark:hover:bg-gray-700"
              title="Rotar imagen"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => applyZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          {zoom > MIN_ZOOM && (
            <button
              type="button"
              onClick={() => {
                setZoom(MIN_ZOOM);
                setPan({ x: 0, y: 0 });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow hover:bg-white dark:hover:bg-gray-700"
              title="Restablecer zoom"
            >
              <Maximize2 className="h-4 w-4" />
              <span>{Math.round(zoom * 100)}%</span>
            </button>
          )}
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`select-none transition-transform ${isDragging ? "" : "duration-150"} ${
          zoom > MIN_ZOOM ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
        } ${imgClassName}`}
        style={{ ...imgStyle, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)` }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        draggable={false}
        onError={onError}
      />
    </div>
  );
};

export default ZoomableVoucherImage;
