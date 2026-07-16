import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Users, Phone, Loader2, ChevronRight } from 'lucide-react';
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
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const isSearching = searchTerm.trim().length > 0;

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
              // Con búsqueda activa, los grupos con coincidencias se muestran abiertos.
              const isOpen = hasWorkers && (isSearching ? true : expandedIds.has(sucursal.id));
              return (
                <div
                  key={sucursal.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                >
                  {/* Fila compacta de la sucursal */}
                  <button
                    type="button"
                    onClick={() => hasWorkers && toggleExpanded(sucursal.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      hasWorkers
                        ? 'hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    <ChevronRight
                      size={16}
                      className={`flex-shrink-0 text-gray-400 transition-transform ${
                        isOpen ? 'rotate-90' : ''
                      } ${hasWorkers ? '' : 'opacity-0'}`}
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

                  {/* Personal (colapsable) */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden bg-gray-50/60 dark:bg-gray-900/30"
                      >
                        {workers.map((trabajador) => (
                          <li
                            key={trabajador.id}
                            className="flex items-center gap-2.5 pl-9 pr-3 py-2 border-t border-gray-100 dark:border-gray-700/50"
                          >
                            <div className="h-6 w-6 rounded-full bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-[10px] flex-shrink-0">
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
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 pt-3">
            {groups.length} sucursal(es) · {totalTrabajadores} trabajador(es)
          </p>
        </>
      )}
    </div>
  );
};

export default SucursalesView;
