import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../contexts/AuthContext.jsx';
import ToggleSwitch from './ToggleSwitch';
import UserFormModal from './UserFormModal.jsx';
import {
  User,
  Search,
  Shield,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  Plus,
  Edit
} from 'lucide-react';

const UsuariosView = ({ empresas = [], sucursales = [] }) => {
  const { users, updateUserProfile, createUserProfile, currentUser: loggedInUser } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const handleToggleStatus = async (userId, currentStatus) => {
    if (userId === loggedInUser.id) {
      alert("No puedes desactivar tu propia cuenta.");
      return;
    }
    const newStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    await updateUserProfile(userId, { estado: newStatus });
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (usuario) => {
    setEditingUser(usuario);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (userIdOrData, maybeUpdates) => {
    if (editingUser) {
      await updateUserProfile(userIdOrData, maybeUpdates);
    } else {
      await createUserProfile(userIdOrData);
    }
  };

  const filteredUsuarios = (users || []).filter(usuario => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const matchesSearch = (usuario.nombre && usuario.nombre.toLowerCase().includes(lowerCaseSearchTerm)) ||
                         (usuario.usuario && usuario.usuario.toLowerCase().includes(lowerCaseSearchTerm)) ||
                         (usuario.email && usuario.email.toLowerCase().includes(lowerCaseSearchTerm));
    
    const matchesRole = filterRole === 'all' || usuario.user_rol === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const getRoleColor = (rol) => {
    switch(rol) {
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'finanzas': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getRoleIcon = (rol) => {
    switch(rol) {
      case 'admin': return <Shield size={10} />;
      case 'finanzas': return <UserCheck size={10} />;
      default: return <User size={10} />;
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return null;
    return new Date(isoString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestión de Usuarios</h2>
          <p className="text-gray-600 dark:text-gray-400">Administra usuarios y permisos del sistema.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          <span>Añadir Usuario</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 mb-6">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
          />
        </div>
        
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
        >
          <option value="all">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="finanzas">Finanzas</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsuarios.map((usuario) => (
          <motion.div
            key={usuario.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-blue-500/10 transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {(usuario.nombre || 'UU').split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{usuario.nombre || 'Usuario sin nombre'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center" title={usuario.email}>
                    <Mail size={10} className="mr-1.5 flex-shrink-0" />
                    {usuario.email || 'Sin correo electrónico'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                 <button
                    onClick={() => handleOpenEditModal(usuario)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title="Editar usuario"
                  >
                    <Edit size={12} className="text-gray-600 dark:text-gray-300" />
                  </button>
                 <ToggleSwitch
                    checked={usuario.estado === 'activo'}
                    onChange={() => handleToggleStatus(usuario.id, usuario.estado)}
                  />
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar size={10} className="text-gray-400" />
                <span>
                  Último acceso: {
                    usuario.last_sign_in_at 
                    ? formatDateTime(usuario.last_sign_in_at) 
                    : <span className="text-gray-400 italic">Nunca</span>
                  }
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(usuario.user_rol)}`}>
                {getRoleIcon(usuario.user_rol)}
                <span className="capitalize">{usuario.user_rol}</span>
              </span>
              
              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                usuario.estado === 'activo' 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
              }`}>
                {usuario.estado === 'activo' ? <UserCheck size={8} /> : <UserX size={8} />}
                <span className="capitalize">{usuario.estado}</span>
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <UserFormModal
            onClose={handleCloseModal}
            onSave={handleSaveUser}
            userToEdit={editingUser}
            empresas={empresas}
            sucursales={sucursales}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UsuariosView;
