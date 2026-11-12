import React, { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, MessageSquareWarning, Pencil, Plus, Trash2, X } from "lucide-react";
import ToggleSwitch from "./ToggleSwitch";
import {
  createMotivoRechazo,
  deleteMotivoRechazo,
  fetchMotivosRechazo,
  updateMotivoRechazo,
} from "../features/deposits/api/depositsApi.js";
import { invalidateMotivosRechazoCache } from "./RejectionModal.jsx";

// Administración de los motivos de rechazo frecuentes (los chips del modal
// "Rechazar depósito"). Solo admin. Los desactivados dejan de mostrarse en
// el modal pero se conservan; el orden de esta lista es el de los chips.
const MAX_TEXTO = 150;

const MotivosRechazoView = () => {
  const [motivos, setMotivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMotivosRechazo({ incluirInactivos: true });
      setMotivos(data.sort((a, b) => a.orden - b.orden));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los motivos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setSaving(true);
    setError("");
    try {
      await fn();
      invalidateMotivosRechazoCache();
      await load();
    } catch (err) {
      setError(err.message || "No se pudo guardar el cambio.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const texto = nuevo.trim();
    if (!texto) return;
    if (motivos.some((m) => m.texto.toLowerCase() === texto.toLowerCase())) {
      setError("Ese motivo ya existe.");
      return;
    }
    const orden = motivos.length ? Math.max(...motivos.map((m) => m.orden)) + 1 : 1;
    run(async () => {
      await createMotivoRechazo({ texto, orden, activo: true });
      setNuevo("");
    });
  };

  const handleSaveEdit = (m) => {
    const texto = editText.trim();
    if (!texto || texto === m.texto) {
      setEditingId(null);
      return;
    }
    run(async () => {
      await updateMotivoRechazo(m.id, { texto, orden: m.orden, activo: m.activo });
      setEditingId(null);
    });
  };

  const handleMove = (index, delta) => {
    const a = motivos[index];
    const b = motivos[index + delta];
    if (!a || !b) return;
    run(async () => {
      await updateMotivoRechazo(a.id, { texto: a.texto, orden: b.orden, activo: a.activo });
      await updateMotivoRechazo(b.id, { texto: b.texto, orden: a.orden, activo: b.activo });
    });
  };

  const handleDelete = (m) => {
    if (!window.confirm(`¿Eliminar el motivo "${m.texto}"? Los rechazos ya hechos no cambian.`)) return;
    run(() => deleteMotivoRechazo(m.id));
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <MessageSquareWarning className="h-6 w-6 text-red-500" />
          Motivos de rechazo
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Aparecen como opciones rápidas al rechazar un depósito, en este orden. Los desactivados no se muestran.
        </p>
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          type="text"
          value={nuevo}
          maxLength={MAX_TEXTO}
          onChange={(e) => {
            setNuevo(e.target.value);
            setError("");
          }}
          placeholder="Nuevo motivo, por ejemplo: Enviar voucher legible"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
        <button
          type="submit"
          disabled={saving || !nuevo.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : motivos.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Aún no hay motivos. Agrega el primero arriba.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {motivos.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMove(i, -1)}
                    disabled={saving || i === 0}
                    className="rounded p-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                    aria-label="Subir"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(i, 1)}
                    disabled={saving || i === motivos.length - 1}
                    className="rounded p-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                    aria-label="Bajar"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  {editingId === m.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editText}
                        maxLength={MAX_TEXTO}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(m);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <button type="button" onClick={() => handleSaveEdit(m)} className="rounded p-1 text-emerald-600 hover:bg-emerald-50" aria-label="Guardar">
                        <Check className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Cancelar">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`inline-block rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                        m.activo
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "border-gray-200 bg-gray-50 text-gray-400 line-through dark:border-gray-700 dark:bg-gray-900"
                      }`}
                    >
                      {m.texto}
                    </span>
                  )}
                </div>

                <ToggleSwitch
                  checked={m.activo}
                  onChange={() => run(() => updateMotivoRechazo(m.id, { texto: m.texto, orden: m.orden, activo: !m.activo }))}
                />
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(m.id);
                    setEditText(m.texto);
                  }}
                  disabled={saving}
                  className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m)}
                  disabled={saving}
                  className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MotivosRechazoView;
