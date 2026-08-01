import React, { useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AuthContext } from "../contexts/AuthContext.jsx";
import { fetchAvisos, desactivarAviso, reenviarAviso } from "../features/avisos/api/avisosApi.js";
import AvisoFormModal from "./AvisoFormModal.jsx";
import { Plus, Bell, Smartphone, MessageCircle, Mail, RefreshCw, Ban, Image as ImageIcon, Pencil, Send, Search } from "lucide-react";

const ROL_LABELS = { vendedor: "Vendedor", finanzas: "Finanzas", admin: "Admin" };
const CANAL_LABELS = { app: "App", whatsapp: "WhatsApp", email: "Email" };
const ESTADO_LABELS = { programado: "Programado", enviado: "Enviado" };

function formatDateTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const AvisosView = () => {
  const { currentUser } = useContext(AuthContext);
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // null = cerrado, "new" = creando, objeto aviso = editando ese aviso
  const [formTarget, setFormTarget] = useState(null);
  const [reenviandoId, setReenviandoId] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroCanal, setFiltroCanal] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);

  const isAdmin = currentUser?.user_rol === "admin";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAvisos();
      setAvisos(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los avisos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const avisosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return avisos.filter((aviso) => {
      if (texto && !aviso.titulo.toLowerCase().includes(texto)) return false;
      if (filtroRol && !(aviso.rolesDestino || []).includes(filtroRol)) return false;
      if (filtroCanal === "app" && !aviso.enviarApp) return false;
      if (filtroCanal === "whatsapp" && !aviso.enviarWhatsapp) return false;
      if (filtroCanal === "email" && !aviso.enviarEmail) return false;
      if (filtroEstado && aviso.estado !== filtroEstado) return false;
      if (soloActivos && !aviso.activo) return false;
      return true;
    });
  }, [avisos, busqueda, filtroRol, filtroCanal, filtroEstado, soloActivos]);

  const handleDesactivar = async (id) => {
    if (!window.confirm("¿Desactivar este aviso? Dejará de enviarse.")) return;
    try {
      await desactivarAviso(id);
      load();
    } catch (err) {
      alert(err.message || "No se pudo desactivar el aviso.");
    }
  };

  const handleReenviar = async (aviso) => {
    if (!window.confirm(`¿Reenviar "${aviso.titulo}" ahora?`)) return;
    setReenviandoId(aviso.id);
    try {
      await reenviarAviso(aviso.id);
      load();
    } catch (err) {
      alert(err.message || "No se pudo reenviar el aviso.");
    } finally {
      setReenviandoId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-gray-500 dark:text-gray-400">
        No tienes permisos para ver esta sección.
      </div>
    );
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell size={20} />
            Avisos
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Comunicados a usuarios de la app, por WhatsApp o email (vía Zavu).
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center space-x-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={() => setFormTarget("new")}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            <span>Nuevo Aviso</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
          />
        </div>
        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
        >
          <option value="">Todos los roles</option>
          {Object.entries(ROL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={filtroCanal}
          onChange={(e) => setFiltroCanal(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
        >
          <option value="">Todos los canales</option>
          {Object.entries(CANAL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
          Solo activos
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Título</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Roles</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Canales</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Recurrencia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Próxima ejecución</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Última ejecución</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Creado por</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {avisosFiltrados.map((aviso) => (
                <tr key={aviso.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate" title={aviso.titulo}>
                    <span className="inline-flex items-center gap-1.5">
                      {aviso.mediaUrl && <ImageIcon size={12} className="text-gray-400 flex-shrink-0" titleAccess="Tiene imagen adjunta" />}
                      {aviso.titulo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {(aviso.rolesDestino || []).map((r) => ROL_LABELS[r] || r).join(", ")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {aviso.enviarApp && <Smartphone size={14} className="text-blue-500" titleAccess="App" />}
                      {aviso.enviarWhatsapp && <MessageCircle size={14} className="text-emerald-500" titleAccess="WhatsApp" />}
                      {aviso.enviarEmail && <Mail size={14} className="text-amber-500" titleAccess="Email" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {aviso.esRecurrente ? `Recurrente (${aviso.frecuencia})` : "Única vez"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatDateTime(aviso.proximaEjecucion)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatDateTime(aviso.ultimaEjecucion)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {aviso.creadoPorNombre || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      !aviso.activo
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        : aviso.estado === "enviado"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    }`}>
                      {!aviso.activo ? "Desactivado" : aviso.estado === "enviado" ? "Enviado" : "Programado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setFormTarget(aviso)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                        title="Editar aviso"
                      >
                        <Pencil size={11} />
                        Editar
                      </button>
                      {(aviso.estado === "enviado" || aviso.esRecurrente) && (
                        <button
                          onClick={() => handleReenviar(aviso)}
                          disabled={reenviandoId === aviso.id}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
                          title="Reenviar aviso"
                        >
                          <Send size={11} />
                          Reenviar
                        </button>
                      )}
                      {aviso.activo && (
                        <button
                          onClick={() => handleDesactivar(aviso.id)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                          title="Desactivar aviso"
                        >
                          <Ban size={11} />
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && avisosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {avisos.length === 0 ? "No hay avisos creados todavía." : "Ningún aviso coincide con los filtros."}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {formTarget && (
          <AvisoFormModal
            onClose={() => setFormTarget(null)}
            onSaved={load}
            avisoExistente={formTarget === "new" ? null : formTarget}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvisosView;
