import { X } from "lucide-react";
import ZoomableVoucherImage from "../../../features/deposit-detail/ui/ZoomableVoucherImage.jsx";
import { useEscapeClose } from "../../../hooks/useEscapeClose.js";
import { formatDate } from "../../../utils/dateFormatters.js";

// Vista ampliada de un voucher individual al hacer click en su miniatura.
// Reutiliza ZoomableVoucherImage (mismo componente que ya usan el panel de
// detalle y el modal de Consulta SQL Server) en vez de reimplementar
// zoom/rotacion aca.
const VoucherLightbox = ({ deposit, onClose }) => {
  useEscapeClose(onClose, !!deposit);

  if (!deposit) return null;

  const simbolo = deposit.moneda === "USD" ? "$" : "S/";
  const monto = Number(deposit.monto || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
              {deposit.empresa?.nombre || "Empresa no identificada"} ·{" "}
              {deposit.banco?.abreviatura || deposit.banco?.nombre || "Banco no identificado"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(deposit.fecha_deposito || deposit.fecha_registro)} · {simbolo} {monto}
              {deposit.numero_operacion ? ` · Op. ${deposit.numero_operacion}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Cerrar"
            title="Cerrar (Esc)"
          >
            <X size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-gray-100 dark:bg-gray-950">
          <ZoomableVoucherImage
            src={deposit.imagen_voucher}
            alt={`Voucher de ${deposit.cliente || deposit.numero_operacion || "depósito"}`}
            resetKey={deposit.imagen_voucher}
            imgClassName="max-h-full max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default VoucherLightbox;
