import React from "react";
import { Edit, Eye } from "lucide-react";

export default function DepositsTable({
  filteredDeposits,
  formatDate,
  formatDateTime,
  getStatusBadge,
  onEditDeposit,
  onViewVoucher,
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Empresa</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Sucursal - Contacto</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Anexo Banco</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Nro Operación Banco</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha Depósito</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Importe</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Estado</th>
              <th className="w-20 max-w-20 px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Motivo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Validado por</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha Recibido</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Nombre Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">RUC/DNI Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Ref. Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">URL Voucher</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {filteredDeposits.map((deposit) => (
              <tr
                key={deposit.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {deposit.empresa?.nombre || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {deposit.sucursal?.nombre || "-"}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {deposit.trabajador?.nombre || "-"}
                    </span>
                    {deposit.trabajador?.telefono_origen && (
                      <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                        {deposit.trabajador.telefono_origen.startsWith("51")
                          ? deposit.trabajador.telefono_origen.slice(2)
                          : deposit.trabajador.telefono_origen}
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {deposit.anexo || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {deposit.numero_operacion_banco || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(deposit.fecha_deposito)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {(deposit.monto || 0).toLocaleString("es-ES", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  {deposit.moneda}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {getStatusBadge(deposit.estado)}
                </td>
                <td
                  className="w-20 max-w-20 truncate px-2 py-4 align-top text-xs text-red-600 dark:text-red-400"
                  title={
                    deposit.estado === "rechazado"
                      ? String(
                          deposit.observaciones || deposit.motivo_rechazo || "",
                        ).trim()
                      : ""
                  }
                >
                  {deposit.estado === "rechazado"
                    ? String(
                        deposit.observaciones || deposit.motivo_rechazo || "",
                      ).trim()
                    : "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {deposit.validado_por_usuario?.nombre || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatDateTime(deposit.fecha_registro)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200">
                  {deposit.cliente || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500 dark:text-gray-400">
                  {deposit.ruc_cliente || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {deposit.referencia_cliente || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {deposit.imagen_voucher ? (
                    <a
                      href={deposit.imagen_voucher}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-xs truncate text-blue-600 hover:underline dark:text-blue-400"
                      title={deposit.imagen_voucher}
                    >
                      {deposit.imagen_voucher.length > 40
                        ? `${deposit.imagen_voucher.substring(0, 40)}...`
                        : deposit.imagen_voucher}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    {deposit.imagen_voucher && (
                      <button
                        onClick={() => onViewVoucher(deposit.imagen_voucher)}
                        className="inline-flex items-center space-x-1.5 rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                        title="Ver voucher del registro manual"
                      >
                        <Eye size={14} />
                        <span>Ver Voucher</span>
                      </button>
                    )}
                    <button
                      onClick={() => onEditDeposit(deposit)}
                      className="rounded-md p-2 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
                      title="Editar depósito"
                    >
                      <Edit
                        size={14}
                        className="text-gray-600 dark:text-gray-300"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredDeposits.length === 0 && (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            <p>No se encontraron depósitos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
