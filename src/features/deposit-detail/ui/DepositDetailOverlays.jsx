import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  X,
} from "lucide-react";

export function ContactDetailsPortal({
  isOpen,
  onClose,
  contactRows,
  phoneNumber,
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Datos del contacto
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Información de la persona y sucursal asociada al depósito.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {contactRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {row.label}
                    </div>
                    <div className="mt-1 break-words text-sm font-mono text-slate-900 dark:text-slate-100">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function FloatingVoucherPortal({
  isOpen,
  onClose,
  voucherUrl,
  operationNumber,
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative flex h-[93vh] w-full max-w-6xl flex-col rounded-lg bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between rounded-t-lg border-b bg-gray-50 p-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Voucher: {operationNumber || "Sin número"}
              </h3>
              <button
                onClick={onClose}
                className="rounded-full p-2 transition-colors hover:bg-gray-200"
                title="Cerrar"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <iframe
                src={voucherUrl}
                className="h-full w-full rounded border-0"
                title="Voucher PDF"
                style={{
                  minHeight: "calc(93vh - 100px)",
                  height: "calc(93vh - 100px)",
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function NoDuplicatePortal({
  isOpen,
  onClose,
  snapshotText,
  onConfirm,
  onToggleOld,
  canConfirm,
  isSending,
  isProcessing,
  isOld,
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500 p-2">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                    Sin duplicados
                  </h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-200">
                    No se encontraron coincidencias. Puedes confirmar el depósito.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-emerald-700 transition-colors hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  Datos de la tienda
                </div>
                <div className="whitespace-pre-line rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 dark:border-slate-700 dark:bg-gray-950/30 dark:text-slate-100">
                  {snapshotText}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={!canConfirm || isSending || isProcessing}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Confirmar depósito"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={onToggleOld}
                  disabled={isProcessing}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                    isOld
                      ? "bg-slate-700 text-white hover:bg-slate-800"
                      : "bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  {isOld ? "Antiguo ✓" : "Antiguo"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function DuplicateDepositsPortal({
  isOpen,
  onClose,
  onReject,
  duplicateDeposits,
  getStatusInfo,
  formatCompactMoney,
  formatDateTime,
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-red-50 p-4 dark:border-gray-700 dark:bg-red-900/20">
              <div className="flex items-center space-x-3">
                <div className="rounded-lg bg-red-500 p-2">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                    Depósitos Duplicados Encontrados
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Se encontraron {duplicateDeposits.length} depósito(s) con datos similares
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
                title="Cerrar"
              >
                <X className="h-5 w-5 text-red-600 dark:text-red-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                <div className="text-sm font-bold text-red-900 dark:text-red-100">
                  Depósitos duplicados encontrados
                </div>
                <div className="mt-1 text-sm text-red-700 dark:text-red-200">
                  Se muestran los depósitos encontrados como cards individuales.
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {duplicateDeposits.map((dup, index) => {
                  const statusInfo = getStatusInfo(dup.estado);
                  const StatusIcon = statusInfo.Icon;
                  return (
                    <div
                      key={dup.id || `${dup.numero_operacion_banco || dup.numero_operacion || "dup"}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            Duplicado #{index + 1}
                          </div>
                          <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                            {dup.sucursal?.nombre || "Sin sucursal"}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusInfo.color}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm">
                        <Field label="Empresa" value={dup.empresa?.abreviatura || dup.empresa?.nombre || "-"} />
                        <Field label="Banco" value={dup.banco?.abreviatura || dup.banco?.nombre || "-"} />
                        <Field label="Nro. operación" value={dup.numero_operacion_banco || dup.numero_operacion || "-"} mono />
                        <Field label="Importe" value={formatCompactMoney(dup.monto, dup.moneda)} mono />
                        <Field label="Fecha depósito" value={dup.fecha_deposito || "-"} />
                        <Field label="Fecha registro" value={formatDateTime(dup.fecha_registro)} />
                        <Field
                          label="Personal"
                          value={dup.trabajador?.nombre || "-"}
                          className="md:col-span-2"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 rounded-b-xl border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <button
                onClick={onReject}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
              >
                Rechazar
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Field({ label, value, mono = false, className = "" }) {
  return (
    <div className={`rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70 ${className}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div
        className={`mt-0.5 font-medium text-slate-900 dark:text-slate-100 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
