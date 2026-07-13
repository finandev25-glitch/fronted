import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Phone, Loader2 } from 'lucide-react';

// Edita un Trabajador existente. UpdateTrabajadorRequest (backend) solo
// permite cambiar Nombre/TelefonoPersonal/SucursalId/Activo — la EmpresaId no
// se puede modificar despues de creado el Trabajador, por eso este modal no
// incluye un selector de empresa.
const EditTrabajadorModal = ({ onClose, onSave, trabajador, sucursales = [] }) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (trabajador) {
      setNombre(trabajador.nombre || '');
      setTelefono(trabajador.telefono_origen || '');
      setSucursalId(trabajador.sucursal_id || '');
    }
  }, [trabajador]);

  const sucursalesDeEmpresa = sucursales.filter(
    (s) => !trabajador?.empresa_id || s.empresa_id === trabajador.empresa_id
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('El nombre del trabajador es obligatorio.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave(trabajador.id, {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        sucursal_id: sucursalId || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el trabajador.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="bg-white rounded-xl w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Editar Trabajador</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3">
            <div>
              <label htmlFor="edit-trabajador-nombre" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="edit-trabajador-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-trabajador-telefono" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono personal (opcional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  id="edit-trabajador-telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-trabajador-sucursal" className="block text-sm font-medium text-gray-700 mb-1.5">Sucursal (opcional)</label>
              <select
                id="edit-trabajador-sucursal"
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Sin sucursal asignada</option>
                {sucursalesDeEmpresa.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-2 bg-gray-50/50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm disabled:opacity-60 flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default EditTrabajadorModal;
