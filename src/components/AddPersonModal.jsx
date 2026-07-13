import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Phone, Search, Eye, EyeOff, Loader2, UserCheck, UserPlus, Mail, Lock, Building2 } from 'lucide-react';
import { fetchProfiles, createProfile } from '../features/deposits/api/depositsApi.js';
import PasswordStrengthMeter from './PasswordStrengthMeter.jsx';

const ROLES = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'admin', label: 'Administrador' },
];

// AddPersonModal crea un Trabajador (registro de personal en una sucursal),
// que en el backend SIEMPRE debe apuntar a un Profile ya existente
// (POST /v1/masters/trabajadores exige ProfileId y lo valida contra la tabla
// Profiles). Por eso este modal ofrece dos caminos para conseguir ese
// profileId antes de crear el Trabajador:
//  - "existing": elegir un Profile ya dado de alta (GET /v1/masters/profiles).
//  - "new": crear un Profile nuevo aca mismo (POST /v1/masters/profiles) y
//    usar el id devuelto.
//
// Contexto empresa/sucursal del Trabajador: cuando se abre con una "sucursal"
// fija (uso actual desde SucursalDetailModal) esa sucursal determina la
// empresa; cuando se abre SIN sucursal fija (uso nuevo desde TrabajadoresView)
// se muestra un selector de Empresa (obligatorio, CreateTrabajadorRequest.
// EmpresaId no es nullable) y de Sucursal (opcional, SucursalId si es
// nullable) para que el admin los elija ahi mismo.
const AddPersonModal = ({ onClose, onSave, sucursal, empresas = [], sucursales = [] }) => {
  const [mode, setMode] = useState('existing');

  // Campos del Trabajador (comunes a ambos modos)
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  // Modo "usuario existente"
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');

  // Modo "crear nuevo usuario" (CreateProfileRequest)
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rol, setRol] = useState('vendedor');
  const [profileEmpresaId, setProfileEmpresaId] = useState(sucursal?.empresa_id || empresas?.[0]?.id || '');

  // Sucursal del Trabajador cuando no hay una "sucursal" fija (ver nota arriba).
  const [trabajadorSucursalId, setTrabajadorSucursalId] = useState(sucursal?.id || '');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Empresa efectiva para filtrar el listado de profiles y para el
  // Trabajador en si: si hay sucursal fija manda esa; si no, la que se haya
  // elegido en el selector "Empresa del trabajador".
  const effectiveEmpresaId = sucursal?.empresa_id || profileEmpresaId || '';

  const sucursalesDeEmpresa = useMemo(
    () => sucursales.filter((s) => !effectiveEmpresaId || s.empresa_id === effectiveEmpresaId),
    [sucursales, effectiveEmpresaId]
  );

  useEffect(() => {
    let active = true;

    const loadProfiles = async () => {
      setProfilesLoading(true);
      setProfilesError('');
      try {
        // Filtramos por la empresa efectiva (sucursal fija, o la elegida en
        // el selector cuando no hay sucursal fija) para no listar usuarios
        // de otras empresas; si no hay ese dato todavia, se listan todos y
        // se deja buscar por nombre/telefono/email en el input de abajo.
        const filtros = { activo: true };
        if (effectiveEmpresaId) filtros.empresaId = effectiveEmpresaId;

        const data = await fetchProfiles(filtros);
        if (active) setProfiles(data || []);
      } catch (err) {
        if (active) setProfilesError(err.message || 'No se pudo cargar la lista de usuarios.');
      } finally {
        if (active) setProfilesLoading(false);
      }
    };

    loadProfiles();
    return () => {
      active = false;
    };
  }, [effectiveEmpresaId]);

  const filteredProfiles = useMemo(() => {
    const term = profileSearch.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter((profile) => {
      return (
        (profile.nombre && profile.nombre.toLowerCase().includes(term)) ||
        (profile.phoneNumber && profile.phoneNumber.toLowerCase().includes(term)) ||
        (profile.email && profile.email.toLowerCase().includes(term))
      );
    });
  }, [profiles, profileSearch]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('El nombre del trabajador es obligatorio.');
      return;
    }

    if (!sucursal && !effectiveEmpresaId) {
      setError('Elegí la empresa del trabajador.');
      return;
    }

    if (mode === 'existing' && !selectedProfileId) {
      setError('Elegí un usuario existente para vincular al trabajador.');
      return;
    }

    if (mode === 'new') {
      if (!newPhone.trim() && !newEmail.trim()) {
        setError('Para crear el usuario indicá al menos un teléfono o un email.');
        return;
      }
      if (!password || password.length < 8) {
        setError('La contraseña del nuevo usuario debe tener al menos 8 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (!profileEmpresaId) {
        setError('Elegí la empresa del nuevo usuario.');
        return;
      }
    }

    setSubmitting(true);

    let createdProfileId = null;
    let profileWasCreatedNow = false;

    try {
      if (mode === 'new') {
        const newProfile = await createProfile({
          phoneNumber: newPhone.trim() || null,
          email: newEmail.trim() || null,
          password,
          nombre: nombre.trim(),
          empresa_id: profileEmpresaId,
          sucursal_id: sucursal?.id || null,
          rol,
        });
        createdProfileId = newProfile?.id;
        profileWasCreatedNow = true;

        if (!createdProfileId) {
          throw new Error('El usuario se creó pero el servidor no devolvió su id.');
        }
      } else {
        createdProfileId = selectedProfileId;
      }

      // A partir de aca, onSave termina llamando a createPersonal
      // (POST /v1/masters/trabajadores) con el profileId resuelto arriba.
      // empresaId/sucursalId van siempre en el payload: cuando el caller
      // tiene su propia sucursal fija (SucursalDetailModal) los ignora y usa
      // la suya; cuando no (TrabajadoresView) los necesita para armar el
      // Trabajador.
      await onSave({
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        profileId: createdProfileId,
        empresaId: effectiveEmpresaId || null,
        sucursalId: sucursal?.id || trabajadorSucursalId || null,
      });
    } catch (err) {
      if (profileWasCreatedNow && createdProfileId) {
        // El Profile SI se creo en el backend; lo que fallo fue el paso 2
        // (vincularlo como Trabajador). No intentamos revertir el Profile
        // automaticamente: se lo dejamos explicito al admin para que decida.
        setError(
          `El usuario "${nombre.trim()}" se creó correctamente (id ${createdProfileId}), ` +
            `pero no se pudo vincular como trabajador de esta sucursal: ${err.message}. ` +
            'El usuario quedó creado en el sistema; pedile a un administrador que lo revise o ' +
            'intentá de nuevo eligiéndolo en la pestaña "Usuario existente".'
        );
      } else {
        setError(err.message || 'No se pudo guardar el trabajador.');
      }
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
          <h2 className="text-base font-bold text-gray-900">Añadir Personal</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="nombre-persona" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del Trabajador</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="nombre-persona"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Juan Pérez"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="telefono-persona" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono personal (opcional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  id="telefono-persona"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 987654321"
                />
              </div>
            </div>

            {/* Empresa/Sucursal del Trabajador: solo cuando el modal se abre
                sin una sucursal fija de contexto (ver TrabajadoresView). Con
                sucursal fija (SucursalDetailModal) esto se resuelve solo, sin
                mostrar nada aca. */}
            {!sucursal && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="trabajador-empresa" className="block text-sm font-medium text-gray-700 mb-1.5">Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select
                      id="trabajador-empresa"
                      value={profileEmpresaId}
                      onChange={(e) => {
                        setProfileEmpresaId(e.target.value);
                        setTrabajadorSucursalId('');
                      }}
                      className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">Seleccioná una empresa</option>
                      {empresas.map((empresa) => (
                        <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="trabajador-sucursal" className="block text-sm font-medium text-gray-700 mb-1.5">Sucursal (opcional)</label>
                  <select
                    id="trabajador-sucursal"
                    value={trabajadorSucursalId}
                    onChange={(e) => setTrabajadorSucursalId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">Sin sucursal asignada</option>
                    {sucursalesDeEmpresa.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Selector de modo: usuario existente vs crear nuevo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cuenta de usuario (login) vinculada</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === 'existing' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <UserCheck size={14} />
                  Usuario existente
                </button>
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === 'new' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <UserPlus size={14} />
                  Crear nuevo usuario
                </button>
              </div>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={profileSearch}
                    onChange={(e) => setProfileSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Buscar por nombre, teléfono o email..."
                  />
                </div>

                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {profilesLoading ? (
                    <div className="p-4 flex items-center justify-center text-gray-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando usuarios...
                    </div>
                  ) : profilesError ? (
                    <div className="p-3 text-sm text-red-600">{profilesError}</div>
                  ) : filteredProfiles.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      No se encontraron usuarios. Probá con otro término de búsqueda o creá uno nuevo.
                    </div>
                  ) : (
                    filteredProfiles.map((profile) => (
                      <button
                        type="button"
                        key={profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 ${
                          selectedProfileId === profile.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{profile.nombre || 'Sin nombre'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {profile.phoneNumber || profile.email || 'Sin contacto'}
                          </p>
                        </div>
                        <span className="ml-2 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                          {profile.rol}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {selectedProfile && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                    Seleccionado: <strong>{selectedProfile.nombre}</strong> ({selectedProfile.rol})
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-gray-50/60">
                <div>
                  <label htmlFor="new-phone" className="block text-xs font-medium text-gray-700 mb-1">Teléfono (login)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      id="new-phone"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Ej: 987654321"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="new-email" className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      id="new-email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Ej: juan@empresa.com"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-gray-500">Se necesita al menos un teléfono o un email para poder iniciar sesión.</p>

                <div>
                  <label htmlFor="new-password" className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-9 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                  <label htmlFor="new-confirm-password" className="block text-xs font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="new-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Repetí la contraseña"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">Las contraseñas no coinciden.</p>
                  )}
                </div>

                <div className={sucursal ? 'grid grid-cols-2 gap-3' : ''}>
                  <div>
                    <label htmlFor="new-rol" className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                    <select
                      id="new-rol"
                      value={rol}
                      onChange={(e) => setRol(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    >
                      {ROLES.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Con sucursal fija, este selector permite que la cuenta
                      (Profile) nueva quede registrada bajo otra empresa que la
                      del Trabajador (son conceptos independientes en el
                      backend). Sin sucursal fija, la empresa ya se eligió
                      arriba en "Empresa" y se reusa para ambos. */}
                  {sucursal && (
                    <div>
                      <label htmlFor="new-empresa" className="block text-xs font-medium text-gray-700 mb-1">Empresa</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <select
                          id="new-empresa"
                          value={profileEmpresaId}
                          onChange={(e) => setProfileEmpresaId(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                        >
                          <option value="">Seleccioná una empresa</option>
                          {empresas.map((empresa) => (
                            <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
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
              Añadir
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AddPersonModal;
