import { useEffect, useState } from "react";
import { AlertTriangle, Download, Eye, ImageOff, Loader2 } from "lucide-react";
import { formatDate } from "../../../utils/dateFormatters.js";

// Una tarjeta con el voucher COMPLETO visible (no recortado a cuadrado como
// antes) más los datos clave y, si corresponde, el botón para marcarlo
// pendiente de regularizar -- mismo criterio de detección de PDF que ya
// usaba la miniatura anterior (ver DepositVoucherPanel).
const VoucherCard = ({
  deposit,
  onOpen,
  onDetectPdf,
  canRegularize,
  onMarkRegularize,
  regularizingId,
}) => {
  const [failed, setFailed] = useState(false);
  const urlLooksPdf = (deposit.imagen_voucher || "").toLowerCase().includes(".pdf");

  useEffect(() => {
    setFailed(false);
  }, [deposit.imagen_voucher]);

  useEffect(() => {
    if (urlLooksPdf) onDetectPdf(deposit.id);
  }, [urlLooksPdf, deposit.id, onDetectPdf]);

  if (urlLooksPdf || failed) return null;

  const simbolo = deposit.moneda === "USD" ? "$" : "S/";
  const monto = Number(deposit.monto || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const isRegularizing = regularizingId === deposit.id;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-700">
        <span
          className="truncate text-xs font-semibold text-gray-600 dark:text-gray-300"
          title={deposit.banco?.nombre}
        >
          {deposit.banco?.abreviatura || deposit.banco?.nombre || "Banco no identificado"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(deposit)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Ver en grande"
            aria-label="Ver en grande"
          >
            <Eye size={14} />
          </button>
          <a
            href={deposit.imagen_voucher}
            download
            target="_blank"
            rel="noreferrer"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Descargar"
            aria-label="Descargar"
          >
            <Download size={14} />
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(deposit)}
        className="block w-full bg-gray-50 dark:bg-gray-950"
        title="Ver en grande"
      >
        <img
          src={deposit.imagen_voucher}
          alt={`Voucher ${deposit.cliente || deposit.numero_operacion || deposit.id}`}
          className="max-h-80 w-full object-contain"
          loading="lazy"
          onError={() => {
            setFailed(true);
            onDetectPdf(deposit.id);
          }}
        />
      </button>

      <div className="flex flex-1 flex-col gap-1 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
        <p className="text-base font-bold text-gray-900 dark:text-gray-100">
          {simbolo} {monto}
        </p>
        <p className="truncate">Op. {deposit.numero_operacion || "N/A"}</p>
        <p className="truncate" title={deposit.sucursal?.nombre}>
          {deposit.sucursal?.nombre || "N/A"}
          {deposit.trabajador?.nombre ? ` · ${deposit.trabajador.nombre}` : ""}
        </p>
        {deposit.validado_por_usuario?.nombre && (
          <p className="truncate">Validado por: {deposit.validado_por_usuario.nombre}</p>
        )}
        <p className="truncate">Recibido: {formatDate(deposit.fecha_registro)}</p>
        {deposit.anexo && <p className="truncate">Anexo: {deposit.anexo}</p>}
      </div>

      {canRegularize && (
        <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
          {deposit.pendiente_regularizar ? (
            <span className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={13} />
              Pendiente de regularizar
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onMarkRegularize(deposit)}
              disabled={isRegularizing}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
              {isRegularizing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <AlertTriangle size={13} />
              )}
              Regularizar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Grilla de vouchers completos. Solo entran depositos que YA tienen voucher
// cargado (imagen_voucher no nulo) -- lo que se filtre como PDF se saca de
// acá via VoucherCard y se reporta hacia arriba con onPdfCountChange, en vez
// de desaparecer sin dejar rastro.
const VoucherGallery = ({
  deposits,
  onOpen,
  onPdfCountChange,
  canRegularize = false,
  onMarkRegularize,
  regularizingId = null,
}) => {
  const [pdfIds, setPdfIds] = useState(() => new Set());

  useEffect(() => {
    setPdfIds(new Set());
  }, [deposits]);

  useEffect(() => {
    onPdfCountChange(pdfIds.size);
  }, [pdfIds, onPdfCountChange]);

  const handleDetectPdf = (id) => {
    setPdfIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  const conVoucher = deposits.filter((d) => d.imagen_voucher);

  if (conVoucher.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <ImageOff size={28} className="mb-2" />
        No hay vouchers con imagen para el rango seleccionado.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {conVoucher.map((deposit) => (
        <VoucherCard
          key={deposit.id}
          deposit={deposit}
          onOpen={onOpen}
          onDetectPdf={handleDetectPdf}
          canRegularize={canRegularize}
          onMarkRegularize={onMarkRegularize}
          regularizingId={regularizingId}
        />
      ))}
    </div>
  );
};

export default VoucherGallery;
