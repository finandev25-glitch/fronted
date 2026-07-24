import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Users, Phone, Loader2, ChevronRight, X } from 'lucide-react';
import { fetchPersonal } from '../features/deposits/api/depositsApi.js';

// Vista "Sucursales" (solo lectura): muestra el personal AGRUPADO POR SUCURSAL,
// al estilo del módulo Trabajadores pero organizado por sucursal. No incluye
// acciones (cambiar estado, editar ni eliminar) ni el panel de baja actividad.
// Conserva la firma de props anterior para no romper AppRoutes, aunque solo usa
// `sucursales` y `empresas`.
const SucursalesView = ({ sucursales = [], empresas = [] }) => {
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('all');
  // En vez de expandir el personal en línea dentro de la grilla (lo que
  // desarmaba el layout cuando una sucursal tenía muchos trabajadores), se
  // abre en una ventana flotante (modal) centrada sobre el contenido.
  const [openSucursalId, setOpenSucursalId] = useState(null);

  const openSucursal = useCallback((id) => setOpenSucursalId(id), []);
  const closeSucursal = useCallback(() => setOpenSucursalId(null), []);

  // Cierra la ventana flotante con Escape.
  useEffect(() => {
    if (!openSucursalId) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') closeSucursal();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openSucursalId, closeSucursal]);

  const loadPersonal = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchPersonal();
      setPersonal(data || []);
    } catch (err) {
      setLoadError(err.message || 'No se pudo cargar el personal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPersonal();
  }, [loadPersonal]);

  // Personal agrupado por sucursal_id, respetando el filtro de empresa.
  const workersBySucursal = useMemo(() => {
    const map = new Map();
    for (const p of personal) {
      if (filterEmpresa !== 'all' && p.empresa_id !== filterEmpresa) continue;
      const key = p.sucursal_id || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    // Orden alfabético del personal dentro de cada sucursal.
    for (const list of map.values()) {
      list.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
    }
    return map;
  }, [personal, filterEmpresa]);

  // Grupos finales a mostrar (aplicando búsqueda por sucursal / trabajador).
  const groups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const result = [];

    const orderedSucursales = [...sucursales].sort((a, b) =>
      String(a.nombre || '').localeCompare(String(b.nombre || '')),
    );

    for (const sucursal of orderedSucursales) {
      const workers = workersBySucursal.get(sucursal.id) || [];
      const sucursalMatches = !term || String(sucursal.nombre || '').toLowerCase().includes(term);
      const matchedWorkers = sucursalMatches
        ? workers
        : workers.filter(
            (w) =>
              String(w.nombre || '').toLowerCase().includes(term) ||
              String(w.telefono_origen || '').toLowerCase().includes(term),
          );

      if (term) {
        // Con búsqueda: solo grupos que calcen (por nombre de sucursal o de trabajador).
        if (!sucursalMatches && matchedWorkers.length === 0) continue;
      } else if (filterEmpresa !== 'all' && workers.length === 0) {
        // Con filtro de empresa (sin búsqueda): ocultar sucursales sin personal de esa empresa.
        continue;
      }

      result.push({ sucursal, workers: matchedWorkers });
    }

    // Grupo "Sin asignar" para personal sin sucursal.
    const noneWorkers = workersBySucursal.get('__none__') || [];
    if (noneWorkers.length > 0) {
      const matched = !term
        ? noneWorkers
        : noneWorkers.filter(
            (w) =>
              String(w.nombre || '').toLowerCase().includes(term) ||
              String(w.telefono_origen || '').toLowerCase().includes(term),
          );
      if (matched.length > 0) {
        result.push({ sucursal: { id: '__none__', nombre: 'Sin asignar' }, workers: matched });
      }
    }

    return result;
  }, [sucursales, workersBySucursal, searchTerm, filterEmpresa]);

  const totalTrabajadores = useMemo(
    () => groups.reduce((acc, g) => acc + g.workers.length, 0),
    [groups],
  );

  // Sucursal actualmente mostrada en la ventana flotante (si hay alguna abierta).
  const openGroup = useMemo(
    () => (openSucursalId ? groups.find((g) => g.sucursal.id === openSucursalId) || null : null),
    [groups, openSucursalId],
  );

  // Si el filtro/búsqueda hace que la sucursal abierta deje de estar en la
  // lista (o se quede sin personal), cierra la ventana flotante para no
  // dejarla "colgada" con datos obsoletos.
  useEffect(() => {
    if (openSucursalId && !openGroup) setOpenSucursalId(null);
  }, [openSucursalId, openGroup]);

  const getInitials = (nombre) => {
    if (!nombre) return '??';
    return nombre.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  };

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sucursales</h2>
        <p className="text-gray-600 dark:text-gray-400">Personal agrupado por sucursal.</p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-grow w-full md:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por sucursal, nombre o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
          />
        </div>
        <select
          value={filterEmpresa}
          onChange={(e) => setFilterEmpresa(e.target.value)}
          className="w-full md:w-auto border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
        >
          <option value="all">Todas las Empresas</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center p-10">
          <Loader2 className="animate-spin inline-block text-gray-400" />
        </div>
      ) : loadError ? (
        <div className="text-center p-6 text-sm text-red-600">{loadError}</div>
      ) : groups.length === 0 ? (
        <div className="text-center p-10 text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
          <Building2 size={22} className="text-gray-300" />
          No se encontraron sucursales con personal.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
            {groups.map(({ sucursal, workers }) => {
              const hasWorkers = workers.length > 0;
              const isOpen = openSucursalId === sucursal.id;
              return (
                <div
                  key={sucursal.id}
                  className={`rounded-xl border bg-white dark:bg-gray-800 overflow-hidden transition-colors ${
                    isOpen
                      ? 'border-indigo-300 dark:border-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Fila compacta de la sucursal: al hacer clic abre el
                      personal en una ventana flotante (ver modal más abajo). */}
                  <button
                    type="button"
                    onClick={() => hasWorkers && openSucursal(sucursal.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      hasWorkers
                        ? 'hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    <ChevronRight
                      size={16}
                      className={`flex-shrink-0 text-gray-400 ${hasWorkers ? '' : 'opacity-0'}`}
                    />
                    <div className="h-7 w-7 rounded-md bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">
                      <Building2 size={15} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {sucursal.nombre}
                    </span>
                    <span
                      className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                        hasWorkers
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                          : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <Users size={11} />
                      {workers.length}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 pt-3">
            {groups.length} sucursal(es) · {totalTrabajadores} trabajador(es)
          </p>
        </>
      )}

      {/* Ventana flotante con el personal de la sucursal seleccionada. */}
      <AnimatePresence>
        {openGroup && (
          <motion.div
            key="sucursal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeSucursal();
            }}
          >
            <motion.div
              key="sucursal-panel"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-md max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800">
                <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">
                  <Building2 size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {openGroup.sucursal.nombre}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Users size={11} />
                    {openGroup.workers.length} trabajador(es)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSucursal}
                  aria-label="Cerrar"
                  className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <ul className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-700/60">
                {openGroup.workers.map((trabajador) => (
                  <li
                    key={trabajador.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-[11px] flex-shrink-0">
                      {getInitials(trabajador.nombre)}
                    </div>
                    <span className="flex-grow text-sm text-gray-800 dark:text-gray-200 truncate">
                      {trabajador.nombre}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      <Phone size={11} className="text-gray-400" />
                      {trabajador.telefono_origen || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SucursalesView;
