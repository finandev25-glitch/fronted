import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { formatShortDate } from "../../../utils/dateFormatters.js";

// Una miniatura individual. Detecta PDFs de dos formas (mismo criterio que
// ya usa DepositVoucherPanel para el panel de detalle):
//   1) la URL delata ".pdf" explicitamente (poco comun, el backend suele
//      mandar el endpoint estable /v1/deposits/{id}/image sin extension).
//   2) el <img> falla al cargar -- un PDF no es una imagen valida, asi que
//      el error del navegador es la señal real en la mayoria de los casos.
// Cuando se detecta un PDF, la celda se oculta (return null) y se avisa al
// padre via onDetectPdf para que lo sume al contador "vouchers en PDF".
const VoucherThumbnail = ({ deposit, onOpen, onDetectPdf }) => {
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

  return (
    <button
      type="button"
      onClick={() => onOpen(deposit)}
      className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-white hover:ring-2 hover:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
      title={`${deposit.empresa?.nombre || ""} · ${deposit.banco?.abreviatura || deposit.banco?.nombre || ""}`}
    >
      <img
        src={deposit.imagen_voucher}
        alt={`Voucher ${deposit.cliente || deposit.numero_operacion || deposit.id}`}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => {
          setFailed(true);
          onDetectPdf(deposit.id);
        }}
      />
      <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] text-white">
        {deposit.banco?.abreviatura || deposit.banco?.nombre || "—"} ·{" "}
        {formatShortDate(deposit.fecha_deposito || deposit.fecha_registro)}
      </div>
      {deposit.monto != null && (
        <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {simbolo} {Number(deposit.monto).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}
    </button>
  );
};

// Grilla de miniaturas. Solo entran depositos que YA tienen voucher cargado
// (imagen_voucher no nulo) -- lo que se filtre como PDF se saca de acá via
// VoucherThumbnail y se reporta hacia arriba con onPdfCountChange, en vez de
// desaparecer sin dejar rastro.
const VoucherGallery = ({ deposits, onOpen, onPdfCountChange }) => {
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {conVoucher.map((deposit) => (
        <VoucherThumbnail
          key={deposit.id}
          deposit={deposit}
          onOpen={onOpen}
          onDetectPdf={handleDetectPdf}
        />
      ))}
    </div>
  );
};

export default VoucherGallery;
