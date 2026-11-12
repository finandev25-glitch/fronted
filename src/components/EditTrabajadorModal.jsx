import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Phone, Loader2, Smartphone, Search, AlertTriangle, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose.js';

// Edita un Trabajador existente. UpdateTrabajadorRequest (backend) solo
// permite cambiar Nombre/TelefonoPersonal/SucursalId/Activo — la EmpresaId no
// se puede modificar despues de creado el Trabajador, por eso este modal no
// incluye un selector de empresa.
//
// "Usuario de la app": permite re-apuntar el trabajador a otra cuenta
// (Profile) de la misma empresa. Solo se listan cuentas activas; las que ya
// tienen OTRO trabajador activo se muestran deshabilitadas (el backend
// también lo bloquea), porque al subir un voucher el backend usa el único
// trabajador activo de la cuenta.
const EditTrabajadorModal = ({
  onClose,
  onSave,
  // (trabajadorId, otroTrabajadorId, { intercambiarTelefono }) => Promise.
  // Si se pasa, las cuentas ocupadas por otro trabajador se pueden elegir
  // para INTERCAMBIAR (cada uno se queda con la cuenta del otro).
  onSwap,
  trabajador,
  sucursales = [],
  profiles = [],
  profilesLoading = false,
  personal = [],
}) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [changingProfile, setChangingProfile] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [newProfileId, setNewProfileId] = useState('');
  const [swapTarget, setSwapTarget] = useState(null); // { profileId, trabajadorId, trabajadorNombre, trabajadorTelefono }
  const [swapPhones, setSwapPhones] = useState(false);

  useEscapeClose(onClose, !submitting);

  useEffect(() => {
    if (trabajador) {
      setNombre(trabajador.nombre || '');
      setTelefono(trabajador.telefono_origen || '');
      setSucursalId(trabajador.sucursal_id || '');
    }
  }, [trabajador]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const currentProfile = profileById.get(trabajador?.profile_id) || null;
  const newProfile = newProfileId ? profileById.get(newProfileId) || null : null;

  // profile_id -> trabajador ACTIVO que lo usa (excluye a este).
  const ocupadoPor = useMemo(() => {
    const map = new Map();
    personal.forEach((p) => {
      if (p.id !== trabajador?.id && p.estado === 'activo' && p.profile_id) map.set(p.profile_id, p);
    });
    return map;
  }, [personal, trabajador?.id]);

  const candidatos = useMemo(() => {
    const term = profileSearch.trim().toLowerCase();
    return profiles
      .filter((p) => p.estado === 'activo')
      .filter((p) => !trabajador?.empresa_id || p.empresa_id === trabajador.empresa_id)
      .filter((p) => p.id !== trabajador?.profile_id)
      .filter(
        (p) =>
          !term ||
          (p.nombre || '').toLowerCase().includes(term) ||
          (p.phoneNumber || '').toLowerCase().includes(term) ||
          (p.email || '').toLowerCase().includes(term)
      )
      .sort((a, b) => Number(ocupadoPor.has(a.id)) - Number(ocupadoPor.has(b.id)) || (a.nombre || '').localeCompare(b.nombre || ''));
  }, [profiles, profileSearch, trabajador?.empresa_id, trabajador?.profile_id, ocupadoPor]);

  const sucursalNombre = (id) => sucursales.find((s) => s.id === id)?.nombre || '';
  const sucursalDistinta =
    newProfile && newProfile.sucursal_id && sucursalId && newProfile.sucursal_id !== sucursalId;

  const cancelProfileChange = () => {
    setChangingProfile(false);
    setNewProfileId('');
    setSwapTarget(null);
    setProfileSearch('');
  };

  const handleSwap = async () => {
    if (!swapTarget || !onSwap) return;
    setError('');
    setSubmitting(true);
    try {
      await onSwap(trabajador.id, swapTarget.trabajadorId, { intercambiarTelefono: swapPhones });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo intercambiar los usuarios.');
    } finally {
      setSubmitting(false);
    }
  };

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
      if (newProfileId && ocupadoPor.has(newProfileId)) {
        setError(`Ese usuario ya está asignado al trabajador activo "${ocupadoPor.get(newProfileId)?.nombre}".`);
        setSubmitting(false);
        return;
      }
      await onSave(trabajador.id, {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        sucursal_id: sucursalId || null,
        ...(newProfileId ? { profile_id: newProfileId } : {}),
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
        className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Editar Trabajador</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="p-5 space-y-3 overflow-y-auto">
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

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Smartphone className="h-4 w-4 text-gray-400" />
                  Usuario de la app
                </span>
                {!changingProfile ? (
                  <button
                    type="button"
                    onClick={() => setChangingProfile(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Cambiar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={cancelProfileChange}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Cancelar cambio
                  </button>
                )}
              </div>

              <p className="mt-1 text-sm text-gray-900">
                {profilesLoading && !currentProfile ? (
                  <span className="text-gray-400">Cargando...</span>
                ) : currentProfile ? (
                  <>
                    {currentProfile.nombre || 'Sin nombre'}{' '}
                    <span className="text-xs text-gray-500">
                      · {currentProfile.phoneNumber || currentProfile.email || 'sin contacto'}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">No encontrado ({trabajador?.profile_id || 'sin usuario'})</span>
                )}
              </p>

              {changingProfile && (
                <div className="mt-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Buscar por nombre, DNI o teléfono..."
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {profilesLoading ? (
                      <div className="flex items-center justify-center p-3 text-sm text-gray-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando usuarios...
                      </div>
                    ) : candidatos.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-500">
                        No hay usuarios activos de esta empresa con ese criterio.
                      </div>
                    ) : (
                      candidatos.map((p) => {
                        const ocupado = ocupadoPor.get(p.id);
                        const swappable = Boolean(ocupado && onSwap);
                        const selected = newProfileId === p.id || swapTarget?.profileId === p.id;
                        return (
                          <button
                            type="button"
                            key={p.id}
                            disabled={Boolean(ocupado) && !swappable}
                            onClick={() => {
                              if (ocupado) {
                                setNewProfileId('');
                                setSwapTarget({
                                  profileId: p.id,
                                  trabajadorId: ocupado.id,
                                  trabajadorNombre: ocupado.nombre,
                                  trabajadorTelefono: ocupado.telefono_origen || '',
                                });
                              } else {
                                setSwapTarget(null);
                                setNewProfileId(p.id);
                              }
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                              ocupado && !swappable ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'
                            } ${selected ? (ocupado ? 'bg-violet-50' : 'bg-blue-50') : ''}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">{p.nombre || 'Sin nombre'}</p>
                              <p className="truncate text-xs text-gray-500">
                                {p.phoneNumber || p.email || 'Sin contacto'}
                                {p.sucursal_id && sucursalNombre(p.sucursal_id) ? ` · ${sucursalNombre(p.sucursal_id)}` : ''}
                              </p>
                            </div>
                            <span className="ml-2 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                              {ocupado ? (swappable ? `Intercambiar con ${ocupado.nombre}` : `Asignado a ${ocupado.nombre}`) : p.rol}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {swapTarget && (
                <div className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-2 text-xs text-violet-900">
                  <p className="flex items-start gap-1 font-medium">
                    <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    Intercambio de usuarios
                  </p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li>
                      <strong>{nombre || trabajador?.nombre}</strong> pasa a usar la cuenta{' '}
                      <strong>{profileById.get(swapTarget.profileId)?.nombre}</strong>
                    </li>
                    <li>
                      <strong>{swapTarget.trabajadorNombre}</strong> pasa a usar la cuenta{' '}
                      <strong>{currentProfile?.nombre || 'actual'}</strong>
                    </li>
                  </ul>
                  <label className="flex cursor-pointer items-start gap-1.5">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={swapPhones}
                      onChange={(e) => setSwapPhones(e.target.checked)}
                    />
                    <span>
                      Intercambiar también los teléfonos personales ({telefono || trabajador?.telefono_origen || 'sin teléfono'} ↔{' '}
                      {swapTarget.trabajadorTelefono || 'sin teléfono'})
                    </span>
                  </label>
                  <p className="text-violet-700">
                    Se hace en un solo paso, sin dejar ninguna cuenta sin trabajador. Los depósitos anteriores no cambian.
                    Otros cambios de este formulario (nombre, sucursal) no se guardan con el intercambio.
                  </p>
                  <button
                    type="button"
                    onClick={handleSwap}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
                    Intercambiar usuarios
                  </button>
                </div>
              )}

              {newProfile && (
                <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="flex items-start gap-1 font-medium">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    Nuevo usuario: {newProfile.nombre} ({newProfile.phoneNumber || newProfile.email || 'sin contacto'})
                  </p>
                  <p>Los depósitos anteriores se quedan con la cuenta anterior; desde ahora los vouchers de esta cuenta se registrarán a nombre de {nombre || trabajador?.nombre}.</p>
                  {currentProfile && (
                    <p>La cuenta de {currentProfile.nombre} dejará de poder subir vouchers hasta que se le asigne otro trabajador.</p>
                  )}
                  {sucursalDistinta && (
                    <p>
                      Ojo: la cuenta nueva pertenece a la sucursal <strong>{sucursalNombre(newProfile.sucursal_id) || 'otra'}</strong>; los
                      depósitos toman la sucursal de la cuenta, no la del trabajador.
                    </p>
                  )}
                </div>
              )}
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
              {newProfile ? 'Guardar y cambiar usuario' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default EditTrabajadorModal;
