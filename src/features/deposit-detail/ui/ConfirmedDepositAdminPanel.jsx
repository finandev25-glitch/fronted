import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ShieldAlert,
  PencilLine,
  RotateCcw,
  XCircle,
  History,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  correctConfirmedDeposit,
  revertConfirmedDeposit,
  fetchDepositCorrecciones,
} from "../../deposits/api/depositsApi.js";
import {
  isNiubizBanco,
  normalizeDateForInput,
} from "../../deposits/components/depositDetailModalHelpers.jsx";

// Panel de corrección administrativa para depósitos CONFIRMADOS.
//  - Solo admin ve las acciones (Corregir datos / Volver a pendiente /
//    Pasar a rechazado). Todas exigen motivo.
//  - Finanzas y admin ven el historial de correcciones del depósito.
// Backend: PUT /{id}/correccion, POST /{id}/revertir, GET /{id}/correcciones.

const MIN_MOTIVO = 5;

const FIELD_LABELS = {
  estado: "Estado",
  anexo: "Anexo",
  numeroOperacion: "N° operación",
  empresaId: "Empresa",
  bancoId: "Banco",
  monto: "Monto",
  moneda: "Moneda",
  fechaDeposito: "Fecha depósito",
  cliente: "Cliente",
  rucCliente: "RUC cliente",
  referenciaCliente: "Referencia",
  numeroTarjeta: "N° tarjeta",
};

const ACCION_INFO = {
  correccion_datos: { label: "Corrección de datos", cls: "text-sky-700 dark:text-sky-300", Icon: PencilLine },
  revertido_pendiente: { label: "Devuelto a pendiente", cls: "text-amber-700 dark:text-amber-300", Icon: RotateCcw },
  revertido_rechazado: { label: "Pasado a rechazado", cls: "text-red-700 dark:text-red-300", Icon: XCircle },
};

const ESTADO_LABEL = {
  procesado: "Pendiente",
  recibido: "Recibido",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
};

const norm = (v) => (v === null || v === undefined ? "" : String(v).trim());
const normId = (v) => norm(v).toLowerCase();

function buildInitialForm(deposit) {
  return {
    empresaId: normId(deposit?.empresa_id || deposit?.empresa?.id),
    bancoId: normId(deposit?.banco_id || deposit?.banco?.id),
    anexo: norm(deposit?.anexo),
    numeroOperacion: norm(deposit?.numero_operacion),
    monto:
      deposit?.monto !== undefined && deposit?.monto !== null
        ? Number(deposit.monto).toFixed(2)
        : "",
    moneda: norm(deposit?.moneda) || "PEN",
    fechaDeposito: normalizeDateForInput(deposit?.fecha_deposito) || "",
    cliente: norm(deposit?.cliente),
    numeroTarjeta: norm(deposit?.numero_tarjeta),
  };
}

function sameValue(key, a, b) {
  if (key === "monto") {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na.toFixed(2) === nb.toFixed(2);
  }
  if (key === "empresaId" || key === "bancoId") return normId(a) === normId(b);
  return norm(a) === norm(b);
}

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-gray-400 dark:text-zinc-500">{hint}</span>}
    </label>
  );
}

function ModalShell({ title, icon, tone, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const toneCls =
    tone === "red"
      ? "border-t-red-500"
      : tone === "amber"
        ? "border-t-amber-500"
        : "border-t-sky-500";

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-t-4 bg-white shadow-2xl dark:bg-zinc-800 ${toneCls}`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-zinc-100">
            {icon}
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-zinc-700">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ConfirmedDepositAdminPanel = ({
  deposit,
  empresas = [],
  bancos = [],
  cuentas = [],
  isAdmin = false,
  canViewHistory = false,
  onDepositUpdated,
}) => {
  const depositId = deposit?.id;
  const isConfirmed = deposit?.estado === "confirmado";

  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [mode, setMode] = useState(null); // "editar" | "pendiente" | "rechazado"
  const [form, setForm] = useState(() => buildInitialForm(deposit));
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const loadHistorial = useCallback(async () => {
    if (!depositId || !canViewHistory) return;
    setLoadingHistorial(true);
    try {
      setHistorial(await fetchDepositCorrecciones(depositId));
    } catch {
      // Backend aún sin el endpoint o sin permisos: se oculta sin ruido.
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, [depositId, canViewHistory]);

  useEffect(() => {
    loadHistorial();
  }, [loadHistorial, deposit?.estado]);

  const empresaName = useCallback(
    (id) => empresas.find((e) => normId(e.id) === normId(id))?.nombre || id || "—",
    [empresas],
  );
  const bancoName = useCallback(
    (id) => bancos.find((b) => normId(b.id) === normId(id))?.nombre || id || "—",
    [bancos],
  );

  const displayValue = useCallback(
    (campo, value) => {
      if (value === null || value === undefined || value === "") return "—";
      if (campo === "empresaId") return empresaName(value);
      if (campo === "bancoId") return bancoName(value);
      if (campo === "estado") return ESTADO_LABEL[value] || value;
      return String(value);
    },
    [empresaName, bancoName],
  );

  const initialForm = useMemo(() => buildInitialForm(deposit), [deposit]);

  const anexoOptions = useMemo(() => {
    const list = (cuentas || [])
      .filter(
        (c) =>
          c.estado !== "inactivo" &&
          (!form.empresaId || normId(c.empresa_id) === form.empresaId) &&
          (!form.bancoId || normId(c.banco_id) === form.bancoId) &&
          c.anexo,
      )
      .map((c) => ({ value: c.anexo, label: c.nro_cuenta ? `${c.anexo} · ${c.nro_cuenta}` : c.anexo }));
    if (form.anexo && !list.some((o) => o.value === form.anexo)) {
      list.unshift({ value: form.anexo, label: `${form.anexo} (actual)` });
    }
    const seen = new Set();
    return list.filter((o) => (seen.has(o.value) ? false : seen.add(o.value)));
  }, [cuentas, form.empresaId, form.bancoId, form.anexo]);

  const selectedBanco = useMemo(
    () => bancos.find((b) => normId(b.id) === form.bancoId) || null,
    [bancos, form.bancoId],
  );
  const showTarjeta = isNiubizBanco(selectedBanco) || Boolean(form.numeroTarjeta);

  const diff = useMemo(
    () =>
      Object.keys(initialForm)
        .filter((k) => !sameValue(k, initialForm[k], form[k]))
        .map((k) => ({ campo: k, antes: initialForm[k], despues: form[k] })),
    [initialForm, form],
  );

  const openMode = (m) => {
    setForm(buildInitialForm(deposit));
    setMotivo("");
    setError("");
    setOkMsg("");
    setMode(m);
  };
  const closeMode = useCallback(() => {
    if (!saving) setMode(null);
  }, [saving]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const motivoOk = motivo.trim().length >= MIN_MOTIVO;

  const handleSubmit = async () => {
    setError("");
    if (!motivoOk) {
      setError(`El motivo es obligatorio (mínimo ${MIN_MOTIVO} caracteres).`);
      return;
    }
    if (mode === "editar") {
      if (diff.length === 0) {
        setError("No hay cambios para guardar.");
        return;
      }
      const vacios = diff.filter((d) => norm(d.despues) === "");
      if (vacios.length > 0) {
        setError(
          `No se puede dejar vacío: ${vacios.map((d) => FIELD_LABELS[d.campo] || d.campo).join(", ")}.`,
        );
        return;
      }
      if (Number(form.monto) <= 0 || !Number.isFinite(Number(form.monto))) {
        setError("El monto debe ser mayor a 0.");
        return;
      }
      if (isNiubizBanco(selectedBanco) && !norm(form.numeroTarjeta)) {
        setError("Los depósitos Niubiz requieren el número de tarjeta.");
        return;
      }
    }

    setSaving(true);
    try {
      let updated;
      if (mode === "editar") {
        const fields = {};
        diff.forEach(({ campo, despues }) => {
          fields[campo] = despues;
        });
        updated = await correctConfirmedDeposit(depositId, { motivo: motivo.trim(), ...fields });
      } else {
        updated = await revertConfirmedDeposit(depositId, {
          motivo: motivo.trim(),
          destino: mode === "pendiente" ? "pendiente" : "rechazado",
        });
      }
      onDepositUpdated?.(updated);
      setOkMsg(
        mode === "editar"
          ? "Datos corregidos."
          : mode === "pendiente"
            ? "Depósito devuelto a pendiente. Se avisó al vendedor."
            : "Depósito pasado a rechazado. Se avisó al vendedor.",
      );
      setMode(null);
      loadHistorial();
    } catch (err) {
      setError(err?.message || "No se pudo completar la acción.");
    } finally {
      setSaving(false);
    }
  };

  const showActions = isAdmin && isConfirmed;
  const showHistory = canViewHistory && historial.length > 0;
  if (!showActions && !showHistory) return null;

  const motivoBlock = (
    <Field label="Motivo (obligatorio)" hint="Queda registrado en el historial del depósito.">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={500}
        autoFocus={mode !== "editar"}
        placeholder={
          mode === "editar"
            ? "Ej.: el monto se registró como 100.00 pero el voucher dice 1000.00"
            : "Ej.: se confirmó por error, el abono no aparece en el banco"
        }
        className={inputCls}
      />
    </Field>
  );

  return (
    <>
      {showActions && (
        <div className="w-full rounded-lg border border-gray-200 border-l-4 border-l-violet-500 bg-white p-2 shadow-md dark:border-zinc-700 dark:border-l-violet-400 dark:bg-zinc-800/50 dark:shadow-black/30">
          <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-zinc-200">
            <ShieldAlert className="h-4 w-4 text-violet-500" />
            Corrección administrativa
          </h4>
          <p className="mb-2 text-[11px] text-gray-500 dark:text-zinc-400">
            Solo para errores al confirmar. Cada acción pide motivo y queda en el historial.
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => openMode("editar")}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:bg-sky-900/50"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Corregir datos
            </button>
            <button
              type="button"
              onClick={() => openMode("pendiente")}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Volver a pendiente
            </button>
            <button
              type="button"
              onClick={() => openMode("rechazado")}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Pasar a rechazado
            </button>
          </div>
          {okMsg && (
            <p className="mt-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              {okMsg}
            </p>
          )}
        </div>
      )}

      {canViewHistory && (showHistory || loadingHistorial) && (
        <div className="w-full rounded-lg border border-gray-200 border-l-4 border-l-violet-500 bg-white p-2 shadow-md dark:border-zinc-700 dark:border-l-violet-400 dark:bg-zinc-800/50 dark:shadow-black/30">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-zinc-200">
            <History className="h-4 w-4 text-violet-500" />
            Historial de correcciones
          </h4>
          {loadingHistorial && historial.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-zinc-500">Cargando...</p>
          ) : (
            <div className="space-y-2">
              {historial.map((h) => {
                const info = ACCION_INFO[h.accion] || { label: h.accion, cls: "", Icon: History };
                const Icon = info.Icon;
                return (
                  <div
                    key={h.id}
                    className="rounded-md border border-violet-200 bg-violet-50/60 p-2 text-xs dark:border-violet-900/50 dark:bg-violet-900/15"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className={`inline-flex items-center gap-1 font-semibold ${info.cls}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {info.label}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                        {h.createdAt ? new Date(h.createdAt).toLocaleString("es-PE") : ""}
                        {h.usuarioNombre ? ` · ${h.usuarioNombre}` : ""}
                      </span>
                    </div>
                    {h.cambios.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {h.cambios.map((c, i) => (
                          <li key={`${h.id}-${i}`} className="flex flex-wrap items-center gap-1 text-gray-700 dark:text-zinc-300">
                            <span className="font-medium">{FIELD_LABELS[c.campo] || c.campo}:</span>
                            <span className="line-through opacity-70">{displayValue(c.campo, c.antes)}</span>
                            <ArrowRight className="h-3 w-3 opacity-60" />
                            <span className="font-medium">{displayValue(c.campo, c.despues)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 italic text-gray-600 dark:text-zinc-400">“{h.motivo}”</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mode === "editar" && (
        <ModalShell
          title="Corregir datos del depósito confirmado"
          icon={<PencilLine className="h-4 w-4 text-sky-500" />}
          tone="sky"
          onClose={closeMode}
          footer={
            <>
              <button
                type="button"
                onClick={closeMode}
                disabled={saving}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || diff.length === 0 || !motivoOk}
                className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar corrección ({diff.length})
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Empresa">
              <select
                value={form.empresaId}
                onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}
                className={inputCls}
              >
                <option value="">—</option>
                {empresas.map((e) => (
                  <option key={e.id} value={normId(e.id)}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Banco">
              <select value={form.bancoId} onChange={setField("bancoId")} className={inputCls}>
                <option value="">—</option>
                {bancos.map((b) => (
                  <option key={b.id} value={normId(b.id)}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Anexo">
              <select value={form.anexo} onChange={setField("anexo")} className={inputCls}>
                <option value="">—</option>
                {anexoOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="N° operación">
              <input value={form.numeroOperacion} onChange={setField("numeroOperacion")} className={inputCls} />
            </Field>
            <Field label="Monto">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.monto}
                onChange={setField("monto")}
                className={inputCls}
              />
            </Field>
            <Field label="Moneda">
              <select value={form.moneda} onChange={setField("moneda")} className={inputCls}>
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Fecha depósito">
              <input type="date" value={form.fechaDeposito} onChange={setField("fechaDeposito")} className={inputCls} />
            </Field>
            <Field label="Cliente">
              <input value={form.cliente} onChange={setField("cliente")} className={inputCls} />
            </Field>
            {showTarjeta && (
              <Field label="N° tarjeta (Niubiz)">
                <input value={form.numeroTarjeta} onChange={setField("numeroTarjeta")} className={inputCls} />
              </Field>
            )}
          </div>

          <div className="mt-3 rounded-md border border-dashed border-gray-300 p-2 dark:border-zinc-600">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Cambios a guardar
            </p>
            {diff.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-zinc-500">Aún no modificaste ningún campo.</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {diff.map((d) => (
                  <li key={d.campo} className="flex flex-wrap items-center gap-1 text-gray-700 dark:text-zinc-300">
                    <span className="font-medium">{FIELD_LABELS[d.campo]}:</span>
                    <span className="line-through opacity-70">{displayValue(d.campo, d.antes)}</span>
                    <ArrowRight className="h-3 w-3 opacity-60" />
                    <span className="font-semibold text-sky-700 dark:text-sky-300">
                      {displayValue(d.campo, d.despues)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3">{motivoBlock}</div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </ModalShell>
      )}

      {(mode === "pendiente" || mode === "rechazado") && (
        <ModalShell
          title={mode === "pendiente" ? "Volver a pendiente" : "Pasar a rechazado"}
          icon={
            mode === "pendiente" ? (
              <RotateCcw className="h-4 w-4 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )
          }
          tone={mode === "pendiente" ? "amber" : "red"}
          onClose={closeMode}
          footer={
            <>
              <button
                type="button"
                onClick={closeMode}
                disabled={saving}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !motivoOk}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  mode === "pendiente" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "pendiente" ? "Devolver a pendiente" : "Rechazar depósito"}
              </button>
            </>
          }
        >
          <div className="mb-3 rounded-md bg-gray-50 p-2 text-xs text-gray-700 dark:bg-zinc-900/60 dark:text-zinc-300">
            <p>
              <span className="font-semibold">Operación:</span> {deposit?.numero_operacion || "—"} ·{" "}
              <span className="font-semibold">Monto:</span> {deposit?.moneda} {Number(deposit?.monto || 0).toFixed(2)}
            </p>
            <p className="mt-1">
              {mode === "pendiente"
                ? "El depósito vuelve a la columna Pendiente, se libera para que cualquier usuario de Finanzas lo valide de nuevo."
                : "El depósito queda rechazado con este motivo y el vendedor podrá regularizar el voucher desde la app."}
            </p>
            <p className="mt-1 font-medium text-amber-700 dark:text-amber-300">
              Se avisará al vendedor por chat y notificación push.
            </p>
          </div>
          {motivoBlock}
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </ModalShell>
      )}
    </>
  );
};

export default ConfirmedDepositAdminPanel;
