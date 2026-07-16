import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Users, Phone, Loader2 } from 'lucide-react';
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

  const empresaById = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);

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

  const getInitials = (nombre) => {
    if (!nombre) return '??';
    return nombre.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  };

  const resolveEmpresaNombre = (sucursal, workers) => {
    const empresaId = sucursal?.empresa_id || workers[0]?.empresa_id;
    return empresaById.get(empresaId)?.nombre || '';
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
        <div className="space-y-5">
          <AnimatePresence>
            {groups.map(({ sucursal, workers }) => {
              const empresaNombre = resolveEmpresaNombre(sucursal, workers);
              return (
                <motion.div
                  key={sucursal.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Cabecera de la sucursal */}
                  <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                          {sucursal.nombre}
                        </h3>
                        {empresaNombre && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{empresaNombre}</p>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 flex-shrink-0">
                      <Users size={12} />
                      {workers.length}
                    </span>
                  </div>

                  {/* Personal de la sucursal */}
                  {workers.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">
                      Sin personal asignado.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {workers.map((trabajador) => (
                        <li
                          key={trabajador.id}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                        >
                          <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs flex-shrink-0">
                            {getInitials(trabajador.nombre)}
                          </div>
                          <span className="flex-grow text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {trabajador.nombre}
                          </span>
                          <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
                            <Phone size={12} className="text-gray-400" />
                            {trabajador.telefono_origen || 'No especificado'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
            {groups.length} sucursal(es) · {totalTrabajadores} trabajador(es)
          </p>
        </div>
      )}
    </div>
  );
};

export default SucursalesView;
