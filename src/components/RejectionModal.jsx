import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, MessageSquareWarning, Loader2, Check } from "lucide-react";
import { useEscapeClose } from "../hooks/useEscapeClose.js";

// Motivos frecuentes: un clic los agrega (uno por línea) y otro los quita.
// El texto sigue siendo editable para agregar detalle propio. Usar siempre
// los mismos textos también deja los rechazos uniformes para los reportes.
export const MOTIVOS_RECHAZO_FRECUENTES = [
  "Enviar voucher completo",
  "Enviar voucher legible",
  "Enviar nombres completos",
  "El abono no existe en el empresa indicada",
  "El abono no existe con el nombre del cliente enviado",
  "El abono no existe en el banco seleccionado",
  "El abono no existe, enviar el voucher mañana",
];

const reasonLines = (text) =>
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const RejectionModal = ({
  onClose,
  onConfirm,
  initialReason = "",
}) => {
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeClose(onClose, !isSubmitting);

  const selectedLines = reasonLines(reason);
  const toggleMotivo = (motivo) => {
    const lines = reasonLines(reason);
    const next = lines.includes(motivo) ? lines.filter((l) => l !== motivo) : [...lines, motivo];
    setReason(next.join("\n"));
    setError("");
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // Evitar múltiples clics

    if (!reason.trim()) {
      setError("El motivo del rechazo es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(reason);
    } catch (error) {
      console.error("Error al rechazar:", error);
      setError("Error al procesar el rechazo. Inténtelo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
    // El setIsSubmitting(false) se maneja en el componente padre
  };

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-base font-bold text-gray-900">
            Rechazar Depósito
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5">
          <label
            htmlFor="rejection-reason"
            className="mb-1.5 flex items-center text-sm font-medium text-gray-700"
          >
            <MessageSquareWarning className="mr-2 h-5 w-5 text-yellow-500" />
            Motivo del Rechazo
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {MOTIVOS_RECHAZO_FRECUENTES.map((motivo) => {
              const active = selectedLines.includes(motivo);
              return (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => toggleMotivo(motivo)}
                  disabled={isSubmitting}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    active
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/50"
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                  {motivo}
                </button>
              );
            })}
          </div>
          <textarea
            id="rejection-reason"
            rows="3"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            placeholder="Elige uno o más motivos, o escribe uno propio..."
            autoFocus
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end space-x-2 border-t border-gray-200 bg-gray-50/50 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center space-x-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <span>Confirmar Rechazo</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
};

export default RejectionModal;
