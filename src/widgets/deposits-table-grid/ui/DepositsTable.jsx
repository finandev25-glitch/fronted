import React from "react";
import { Building2, User } from "lucide-react";

// Badge de moneda con color e ícono según PEN (soles) o USD (dólares).
const monedaBadge = (moneda) => {
  const m = String(moneda || "").toUpperCase();
  if (m === "USD") {
    return {
      symbol: "$",
      label: "USD",
      className:
        "bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-800",
    };
  }
  return {
    symbol: "S/",
    label: "PEN",
    className:
      "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800",
  };
};

// Etiqueta y color del estado para la columna "Validado por".
const estadoInfo = (estado) => {
  switch (estado) {
    case "confirmado":
    case "validado":
      return { label: "CONFIRMADO", className: "text-blue-900 dark:text-blue-200" };
    case "rechazado":
      return { label: "RECHAZADO", className: "text-red-600 dark:text-red-400" };
    case "en_validacion":
      return { label: "EN VALIDACIÓN", className: "text-blue-600 dark:text-blue-300" };
    default:
      return { label: "PENDIENTE", className: "text-amber-600 dark:text-amber-400" };
  }
};

export default function DepositsTable({
  filteredDeposits,
  formatDate,
  formatDateTime,
  getStatusBadge,
  onEditDeposit,
  onViewVoucher,
  // Se conservan en la firma para no romper el llamado desde TablePage.
  canRegularize = false,
  onMarkRegularize,
  onUnmarkRegularize,
  onOpenRegularizeUpload,
}) {
  const th =
    "border-b-2 border-gray-200 dark:border-gray-700 px-4 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
  // Borde vertical entre columnas (todas menos la primera).
  const cellBorder = "border-l border-gray-200 dark:border-gray-700";

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-white shadow-sm dark:bg-gray-800">
            <tr>
              <th className={`${th} text-left`}>Solicitante</th>
              <th className={th}>Recibido</th>
              <th className={th}>Depósito</th>
              <th className="border-b-2 border-gray-200 dark:border-gray-700 px-4 pr-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Importe</th>
              <th className={th}>Validado por</th>
              <th className={th}>Cliente</th>
              <th className={th}>Voucher</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeposits.map((deposit) => {
              const est = estadoInfo(deposit.estado);
              return (
                <tr
                  key={deposit.id}
                  className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
                >
                  {/* Solicitante */}
                  <td className="px-4 py-4 align-middle">
                    <div className="flex flex-col gap-0.5 leading-tight">
                      <span className="text-sm font-bold uppercase text-blue-900 dark:text-blue-200">
                        {deposit.empresa?.nombre || "-"}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-blue-900 dark:text-blue-200">
                        <Building2 size={13} className="flex-shrink-0 text-blue-800 dark:text-blue-300" />
                        {deposit.sucursal?.nombre || "-"}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-blue-900/90 dark:text-blue-200/90">
                        <User size={13} className="flex-shrink-0 text-blue-800 dark:text-blue-300" />
                        {deposit.trabajador?.nombre || "-"}
                      </span>
                    </div>
                  </td>

                  {/* Recibido */}
                  <td className={`px-4 py-4 text-center align-middle text-sm text-gray-700 dark:text-gray-300 ${cellBorder}`}>
                    {formatDateTime(deposit.fecha_registro)}
                  </td>

                  {/* Depósito: anexo + fecha depósito + operación */}
                  <td className={`px-4 py-4 align-middle ${cellBorder}`}>
                    <div className="flex flex-col gap-0.5 leading-tight">
                      <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                        {deposit.anexo || "-"}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(deposit.fecha_deposito)}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        OP:{deposit.numero_operacion || deposit.numero_operacion_banco || "-"}
                      </span>
                    </div>
                  </td>

                  {/* Importe */}
                  <td className={`px-4 pr-6 py-4 text-right align-middle ${cellBorder}`}>
                    {(() => {
                      const mb = monedaBadge(deposit.moneda);
                      return (
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                            <span className="mr-0.5 text-sm text-gray-400">{mb.symbol}</span>
                            {(deposit.monto || 0).toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${mb.className}`}
                          >
                            {mb.label}
                          </span>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Validado por: estado + validador */}
                  <td className={`px-4 py-4 text-center align-middle ${cellBorder}`}>
                    <div className="flex flex-col gap-0.5 leading-tight">
                      <span className={`text-sm font-bold ${est.className}`}>{est.label}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {deposit.validado_por_usuario?.nombre || "-"}
                      </span>
                    </div>
                  </td>

                  {/* Cliente */}
                  <td className={`px-4 py-4 text-center align-middle text-sm text-gray-700 dark:text-gray-300 ${cellBorder}`}>
                    {deposit.cliente || "-"}
                  </td>

                  {/* Voucher */}
                  <td className={`px-4 py-4 text-center align-middle ${cellBorder}`}>
                    <button
                      type="button"
                      onClick={() =>
                        onEditDeposit
                          ? onEditDeposit(deposit)
                          : onViewVoucher?.(deposit.imagen_voucher)
                      }
                      className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
                    >
                      Ver Voucher
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredDeposits.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No hay depósitos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
    </div>
  );
}
