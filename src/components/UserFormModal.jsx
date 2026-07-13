import React, { useContext, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Phone, Mail, Lock, Building2, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import PasswordStrengthMeter from './PasswordStrengthMeter.jsx';
import ToggleSwitch from './ToggleSwitch.jsx';
import { AuthContext } from '../contexts/AuthContext.jsx';

const ROLES = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'admin', label: 'Administrador' },
];

// UserFormModal crea o edita un Profile (cuenta de login del sistema:
// telefono/email + password + rol + empresa/sucursal), usado desde
// UsuariosView. Reusa el mismo look & feel que la rama "crear nuevo usuario"
// de AddPersonModal.jsx.
//
// Crear -> POST /v1/masters/profiles (CreateProfileRequest: Password
// obligatorio, requiere telefono o email, EmpresaId obligatorio).
// Editar -> PUT /v1/masters/profiles/{id} (UpdateProfileRequest: reemplaza el
// perfil completo, NO incluye password; el backend expone un endpoint aparte
// PUT /v1/masters/profiles/{id}/password para resetear contraseña, que no se
// usa todavia desde este modal).
const UserFormModal = ({ onClose, onSave, userToEdit, empresas = [], sucursales = [] }) => {
  const isEditing = !!userToEdit;
  const { resetUserPassword } = useContext(AuthContext);

  const [nombre, setNombre] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rol, setRol] = useState('vendedor');
  const [empresaId, setEmpresaId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [activo, setActivo] = useState(true);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reestablecer contraseña: solo en modo edición, va por un endpoint aparte
  // (PUT /v1/masters/profiles/{id}/password) que no forma parte del guardado
  // normal del perfil (UpdateProfileRequest no incluye password).
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleResetPassword = async () => {
    setResetError('');
    setResetSuccess('');

    if (!newPassword || newPassword.length < 8) {
      setResetError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError('Las contraseñas no coinciden.');
      return;
    }

    setResetting(true);
    try {
      await resetUserPassword(userToEdit.id, newPassword);
      setResetSuccess('Contraseña actualizada correctamente.');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowResetPassword(false);
    } catch (err) {
      setResetError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    if (userToEdit) {
      setNombre(userToEdit.nombre || '');
      setPhoneNumber(userToEdit.phoneNumber || '');
      setEmail(userToEdit.email || '');
      setRol(userToEdit.user_rol || userToEdit.rol || 'vendedor');
      setEmpresaId(userToEdit.empresaId || '');
      setSucursalId(userToEdit.sucursalId || '');
      setActivo((userToEdit.estado || 'activo') === 'activo');
    } else {
      setEmpresaId(empresas?.[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToEdit]);

  const sucursalesDeEmpresa = useMemo(
    () => sucursales.filter((s) => !empresaId || s.empresa_id === empresaId),
    [sucursales, empresaId]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('El nombre completo es obligatorio.');
      return;
    }

    if (!empresaId) {
      setError('Elegí la empresa del usuario.');
      return;
    }

    if (!isEditing) {
      if (!phoneNumber.trim() && !email.trim()) {
        setError('Indicá al menos un teléfono o un email para poder iniciar sesión.');
        return;
      }
      if (!password || password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await onSave(userToEdit.id, {
          nombre: nombre.trim(),
          phoneNumber: phoneNumber.trim() || null,
          email: email.trim() || null,
          empresaId,
          sucursalId: sucursalId || null,
          rol,
          estado: activo ? 'activo' : 'inactivo',
        });
      } else {
        await onSave({
          fullName: nombre.trim(),
          phoneNumber: phoneNumber.trim() || null,
          email: email.trim() || null,
          password,
          empresaId,
          sucursalId: sucursalId || null,
          rol,
        });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el usuario.');
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
        className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {isEditing ? 'Editar Usuario' : 'Añadir Usuario'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="user-nombre" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="user-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Juan Pérez"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="user-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono (login)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  id="user-phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 987654321"
                />
              </div>
            </div>

            <div>
              <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="user-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: juan@empresa.com"
                />
              </div>
            </div>

            {!isEditing && (
              <>
                <p className="text-[11px] text-gray-500 -mt-2">Se necesita al menos un teléfono o un email para poder iniciar sesión.</p>

                <div>
                  <label htmlFor="user-password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="user-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-9 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-1.5">
                      <PasswordStrengthMeter password={password} />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="user-confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="user-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Repetí la contraseña"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">Las contraseñas no coinciden.</p>
                  )}
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="user-rol" className="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
                <select
                  id="user-rol"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {ROLES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="user-empresa" className="block text-sm font-medium text-gray-700 mb-1.5">Empresa</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    id="user-empresa"
                    value={empresaId}
                    onChange={(e) => {
                      setEmpresaId(e.target.value);
                      setSucursalId('');
                    }}
                    className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">Seleccioná una empresa</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="user-sucursal" className="block text-sm font-medium text-gray-700 mb-1.5">Sucursal (opcional)</label>
              <select
                id="user-sucursal"
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

            {isEditing && (
              <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50/60">
                <span className="text-sm font-medium text-gray-700">Cuenta activa</span>
                <ToggleSwitch checked={activo} onChange={() => setActivo((prev) => !prev)} />
              </div>
            )}

            {isEditing && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/60">
                {!showResetPassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPassword(true);
                      setResetSuccess('');
                      setResetError('');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium text-gray-700 hover:text-blue-700"
                  >
                    <KeyRound size={14} />
                    Restablecer contraseña
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <KeyRound size={14} />
                        Nueva contraseña
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowResetPassword(false);
                          setNewPassword('');
                          setConfirmNewPassword('');
                          setResetError('');
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Mínimo 8 caracteres"
                      />
                      {newPassword && (
                        <div className="mt-1.5">
                          <PasswordStrengthMeter password={newPassword} />
                        </div>
                      )}
                    </div>

                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Repetí la contraseña"
                    />

                    {resetError && <p className="text-xs text-red-600">{resetError}</p>}

                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetting}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-900 font-medium text-sm disabled:opacity-60"
                    >
                      {resetting && <Loader2 size={14} className="animate-spin" />}
                      Confirmar nueva contraseña
                    </button>
                  </div>
                )}

                {resetSuccess && (
                  <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                    {resetSuccess}
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>}
          </div>

          <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-2 bg-gray-50/50 rounded-b-xl flex-shrink-0">
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
              {isEditing ? 'Guardar Cambios' : 'Añadir'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default UserFormModal;
