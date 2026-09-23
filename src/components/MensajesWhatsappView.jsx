import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Copy, Check } from 'lucide-react';

// Plantillas simples en código a propósito (ver conversación): no hay CRUD
// para esto todavía -- si más adelante se necesita que cualquier admin edite
// los textos sin tocar código, ahí sí se justifica una tabla + endpoints en
// api-bridge. Cada build(sucursalNombre) devuelve el texto inicial; el
// usuario lo edita libremente en el textarea antes de copiarlo.
const TEMPLATES = [
  {
    key: 'capacitacion',
    label: 'Recordatorio de capacitación',
    build: (sucursalNombre) =>
      `Hola equipo de ${sucursalNombre} 👋\n\n` +
      `Les escribo para hacer seguimiento a la capacitación de [tema de la capacitación].\n\n` +
      `¿Nos pueden confirmar quiénes del equipo todavía no han pasado por esta capacitación? Así coordinamos con esas personas puntualmente.\n\n` +
      `Cualquier duda, quedo atenta(o). ¡Gracias!`,
  },
  {
    key: 'aviso_general',
    label: 'Aviso general',
    build: (sucursalNombre) =>
      `Hola equipo de ${sucursalNombre} 👋\n\n` +
      `Les escribo para comunicarles lo siguiente:\n\n` +
      `[Escribe aquí el detalle del aviso]\n\n` +
      `Cualquier duda, quedo atenta(o). ¡Gracias!`,
  },
  {
    key: 'libre',
    label: 'Mensaje libre',
    build: (sucursalNombre) => `Hola equipo de ${sucursalNombre} 👋\n\n`,
  },
];

// Sección "Mensajes de WhatsApp": genera texto para copiar y pegar en el chat
// o grupo de WhatsApp de una sucursal. A propósito NO envía nada por sí
// misma (ni Zavu ni wa.me) -- ver conversación: Zavu exige plantillas de
// Meta preaprobadas de 2 variables fijas y sin imagen, demasiado rígido para
// un comunicado libre como este. Copiar y pegar manualmente es la ruta más
// simple y sin esas restricciones.
const MensajesWhatsappView = ({ sucursales = [], personal = [] }) => {
  const [sucursalId, setSucursalId] = useState('');
  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key);
  const [mensaje, setMensaje] = useState('');
  const [copied, setCopied] = useState(false);

  const sucursal = useMemo(
    () => sucursales.find((s) => s.id === sucursalId) || null,
    [sucursales, sucursalId]
  );

  const trabajadoresSucursal = useMemo(
    () => personal.filter((p) => p.sucursal_id === sucursalId && p.estado === 'activo'),
    [personal, sucursalId]
  );

  // Regenera el mensaje cuando cambia la sucursal o la plantilla elegida --
  // no en cada tecla mientras el usuario edita el texto libremente.
  useEffect(() => {
    const template = TEMPLATES.find((t) => t.key === templateKey) || TEMPLATES[0];
    const nombre = sucursal?.nombre || 'la sucursal';
    setMensaje(template.build(nombre));
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalId, templateKey]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // La API de portapapeles puede fallar sin permiso/https -- se ignora,
      // el usuario igual puede seleccionar y copiar el texto a mano.
    }
  };

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageCircle size={20} />
          Mensajes de WhatsApp
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Genera un comunicado listo para copiar y pegar en el chat o grupo de WhatsApp de una sucursal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sucursal
            </label>
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
            >
              <option value="">Selecciona una sucursal...</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo de mensaje
            </label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
            >
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900/50">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Personal de la sucursal
                {trabajadoresSucursal.length > 0 && ` (${trabajadoresSucursal.length})`}
              </span>
            </div>
            <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
              {!sucursalId && (
                <div className="p-4 text-sm text-gray-400 dark:text-gray-500">
                  Elige una sucursal para ver su personal.
                </div>
              )}
              {sucursalId && trabajadoresSucursal.length === 0 && (
                <div className="p-4 text-sm text-gray-400 dark:text-gray-500">
                  Sin personal activo registrado.
                </div>
              )}
              {trabajadoresSucursal.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="truncate">{t.nombre}</span>
                  <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {t.telefono_origen || '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mensaje
          </label>
          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={14}
            className="w-full flex-1 resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-400"
            placeholder="El mensaje aparece acá una vez elijas sucursal y tipo..."
          />
          <button
            onClick={handleCopy}
            disabled={!mensaje.trim()}
            className={`mt-3 flex items-center gap-2 self-end rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '¡Copiado!' : 'Copiar mensaje'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MensajesWhatsappView;
