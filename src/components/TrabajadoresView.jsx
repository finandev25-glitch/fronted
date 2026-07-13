import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit, Trash2, Phone, Loader2, Users as UsersIcon } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import AddPersonModal from './AddPersonModal.jsx';
import EditTrabajadorModal from './EditTrabajadorModal.jsx';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { fetchPersonal, createPersonal, updatePersonal, deletePersonal } from '../features/deposits/api/depositsApi.js';

// Vista "Trabajadores": a diferencia de SucursalDetailModal (que gestiona
// personal DENTRO del contexto de una sucursal fija), esta vista lista TODOS
// los trabajadores de todas las empresas/sucursales (fetchPersonal(), sin
// filtro) y deja elegir la empresa/sucursal recien al dar de alta, ya que no
// hay una sucursal de contexto fija. Reusa AddPersonModal tal cual (el mismo
// modal que usa SucursalDetailModal): cuando se le pasa la prop "sucursales"
// y NO se le pasa "sucursal", muestra sus propios selectores de Empresa
// (obligatoria) y Sucursal (opcional) antes de elegir/crear el usuario.
//
// Maneja su propio estado local (no pasa por useDepositCatalogs) porque no
// depende de estar anidada en una sucursal y así evita acoplarse al hook
// pensado para el flujo de Sucursales.
const TrabajadoresView = ({ empresas = [], sucursales = [] }) => {
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTrabajador, setEditingTrabajador] = useState(null);
  const [deletingTrabajador, setDeletingTrabajador] = useState(null);

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

  // TrabajadorResponse (backend) solo trae empresa_id/sucursal_id planos, sin
  // objetos anidados: se resuelven nombre de empresa/sucursal contra las
  // listas ya cargadas por props (mismo patron que BancosView con
  // empresa_id/banco_id de CuentaBancariaResponse).
  const empresaById = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);
  const sucursalById = useMemo(() => new Map(sucursales.map((s) => [s.id, s])), [sucursales]);

  const filteredPersonal = personal.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      (p.nombre && p.nombre.toLowerCase().includes(term)) ||
      (p.telefono_origen && p.telefono_origen.toLowerCase().includes(term));
    const matchesEmpresa = filterEmpresa === 'all' || p.empresa_id === filterEmpresa;
    return matchesSearch && matchesEmpresa;
  });

  // onSave de AddPersonModal en este contexto: el modal ya resolvió el
  // profileId (usuario existente o recien creado) Y, al no tener una
  // "sucursal" fija, tambien devuelve empresaId/sucursalId elegidos por el
  // admin en sus propios selectores. Con eso alcanza para llamar directo a
  // createPersonal (POST /v1/masters/trabajadores).
  const handleAdd = async (data) => {
    if (!data.empresaId) {
      throw new Error('Falta la empresa del trabajador.');
    }

    const nuevo = await createPersonal({
      nombre: data.nombre,
      telefono: data.telefono,
      profileId: data.profileId,
      empresa_id: data.empresaId,
      sucursal_id: data.sucursalId || null,
    });

    setPersonal((prev) => [nuevo, ...prev]);
    setIsAddModalOpen(false);
  };

  const handleUpdate = async (trabajadorId, updates) => {
    // UpdateTrabajadorRequest reemplaza el registro completo
    // (Nombre/TelefonoPersonal/SucursalId/Activo), se mezcla con el actual
    // antes de mandar el PUT (mismo patron que useDepositCatalogs.js).
    const existing = personal.find((item) => item.id === trabajadorId);
    const merged = { ...existing, ...updates };
    const actualizado = await updatePersonal(trabajadorId, merged);
    setPersonal((prev) => prev.map((item) => (item.id === trabajadorId ? { ...item, ...actualizado } : item)));
  };

  const handleToggleStatus = async (trabajador) => {
    const nuevoEstado = trabajador.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      await handleUpdate(trabajador.id, { estado: nuevoEstado });
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTrabajador) return;
    try {
      await deletePersonal(deletingTrabajador.id);
      setPersonal((prev) =>
        prev.map((item) => (item.id === deletingTrabajador.id ? { ...item, estado: 'inactivo' } : item))
      );
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingTrabajador(null);
    }
  };

  const getInitials = (nombre) => {
    if (!nombre) return '??';
    return nombre.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  };

  return (
    <>
      <div className="h-full p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trabajadores</h2>
            <p className="text-gray-600 dark:text-gray-400">Administra el personal de todas las sucursales.</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            <span>Añadir Trabajador</span>
          </button>
        </div>

        <div className="mb-6 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-grow w-full md:w-auto">
            <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
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

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trabajador</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sucursal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teléfono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center p-8">
                      <Loader2 className="animate-spin inline-block text-gray-400" />
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {filteredPersonal.map((trabajador) => (
                      <motion.tr
                        key={trabajador.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs mr-3 flex-shrink-0">
                              {getInitials(trabajador.nombre)}
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{trabajador.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {empresaById.get(trabajador.empresa_id)?.nombre || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {sucursalById.get(trabajador.sucursal_id)?.nombre || 'Sin asignar'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Phone size={12} className="mr-1.5 text-gray-400" />
                            {trabajador.telefono_origen || 'No especificado'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ToggleSwitch
                            checked={trabajador.estado === 'activo'}
                            onChange={() => handleToggleStatus(trabajador)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setEditingTrabajador(trabajador)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Editar trabajador"
                            >
                              <Edit size={12} className="text-gray-600 dark:text-gray-300" />
                            </button>
                            <button
                              onClick={() => setDeletingTrabajador(trabajador)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Dar de baja"
                            >
                              <Trash2 size={12} className="text-rose-600 dark:text-rose-400" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
            {!loading && filteredPersonal.length === 0 && (
              <div className="text-center p-8 text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                <UsersIcon size={20} className="text-gray-300" />
                No se encontraron trabajadores.
              </div>
            )}
            {loadError && <div className="text-center p-4 text-sm text-red-600">{loadError}</div>}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <AddPersonModal
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleAdd}
            empresas={empresas}
            sucursales={sucursales}
          />
        )}
        {editingTrabajador && (
          <EditTrabajadorModal
            trabajador={editingTrabajador}
            sucursales={sucursales}
            onClose={() => setEditingTrabajador(null)}
            onSave={handleUpdate}
          />
        )}
        {deletingTrabajador && (
          <DeleteConfirmationModal
            onClose={() => setDeletingTrabajador(null)}
            onConfirm={handleConfirmDelete}
            title="Dar de baja al trabajador"
            message={`¿Seguro que querés dar de baja a "${deletingTrabajador.nombre}"? Podrás reactivarlo después con el interruptor de estado.`}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default TrabajadoresView;
