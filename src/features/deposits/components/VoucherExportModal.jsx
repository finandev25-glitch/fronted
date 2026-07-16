import React, { useState } from "react";
import { X, Download, Loader2, AlertCircle } from "lucide-react";

// Modal para que finanzas/admin arme un respaldo masivo de vouchers (ZIP),
// solo de depositos ya validados. El ZIP queda organizado por fecha de
// depósito y, dentro de cada fecha, por sucursal. El filtro de sucursal y el
// rango de fechas son opcionales -- si no se elige nada, el backend trae
// todos los vouchers validados disponibles (con un tope de seguridad de 2000
// archivos por descarga, ver GET /v1/deposits/export-vouchers-zip).
export default function VoucherExportModal({ sucursales = [], onClose, onSubmit }) {
  const [sucursalId, setSucursalId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit({
        sucursalId: sucursalId || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo generar el respaldo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Respaldo de vouchers
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Se descarga un ZIP organizado por fecha de depósito y, dentro de cada fecha, por sucursal. Solo
          incluye depósitos ya validados. Los filtros son opcionales.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">Sucursal</label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-gray-700 dark:text-gray-300">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Generando...
              </>
            ) : (
              <>
                <Download size={16} /> Descargar ZIP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
