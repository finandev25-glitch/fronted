import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Building2 } from 'lucide-react';

// CreateSucursalRequest/UpdateSucursalRequest (backend) exigen EmpresaId:
// toda sucursal pertenece a una empresa. Por eso este modal necesita la
// lista de empresas para poder elegirla (mismo patron que CreateCuentaModal).
const CreateSucursalModal = ({ onClose, onSave, sucursalToEdit, empresas = [] }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    empresa_id: '',
  });
  const [error, setError] = useState('');

  const activeEmpresas = empresas.filter((e) => e.estado === 'activo');

  useEffect(() => {
    if (sucursalToEdit) {
      setFormData({
        nombre: sucursalToEdit.nombre,
        direccion: sucursalToEdit.direccion || '',
        empresa_id: sucursalToEdit.empresa_id || '',
      });
    } else {
      setFormData((prev) => ({ ...prev, empresa_id: activeEmpresas[0]?.id || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalToEdit, empresas]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      setError('El nombre de la sucursal es obligatorio.');
      return;
    }
    if (!formData.empresa_id) {
      setError('Debes seleccionar una empresa.');
      return;
    }
    onSave(formData);
  };

  const isEditing = !!sucursalToEdit;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="bg-white rounded-xl w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">{isEditing ? 'Editar Sucursal' : 'Crear Nueva Sucursal'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3">
            <div>
              <label htmlFor="empresa_id" className="block text-sm font-medium text-gray-700 mb-1.5">Empresa</label>
              <select
                id="empresa_id"
                name="empresa_id"
                value={formData.empresa_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecciona una empresa</option>
                {activeEmpresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la Sucursal</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Lima Centro"
                />
              </div>
            </div>
            <div>
              <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1.5">Dirección (Opcional)</label>
              <input
                type="text"
                id="direccion"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: Av. Principal 123"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-2 bg-gray-50/50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
            >
              {isEditing ? 'Guardar Cambios' : 'Guardar Sucursal'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateSucursalModal;
