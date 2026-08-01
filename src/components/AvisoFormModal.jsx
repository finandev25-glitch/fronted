import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Image as ImageIcon, Trash2, Images } from "lucide-react";
import { createAviso, updateAviso, uploadAvisoMedia, getAvisoMediaUrl, getGaleriaImagenUrl } from "../features/avisos/api/avisosApi.js";
import AvisoGaleriaPicker from "./AvisoGaleriaPicker.jsx";

const ROLES = [
  { value: "vendedor", label: "Vendedor" },
  { value: "finanzas", label: "Finanzas" },
  { value: "admin", label: "Administrador" },
];

const FRECUENCIAS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
];

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

const AvisoFormModal = ({ onClose, onSaved, avisoExistente = null }) => {
  const isEditMode = Boolean(avisoExistente);

  const [titulo, setTitulo] = useState(avisoExistente?.titulo || "");
  const [mensajeTexto, setMensajeTexto] = useState(avisoExistente?.mensajeTexto || "");
  const [rolesDestino, setRolesDestino] = useState(avisoExistente?.rolesDestino?.length ? avisoExistente.rolesDestino : ["vendedor"]);

  const [enviarApp, setEnviarApp] = useState(avisoExistente ? avisoExistente.enviarApp : true);
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(avisoExistente?.enviarWhatsapp || false);
  const [enviarEmail, setEnviarEmail] = useState(avisoExistente?.enviarEmail || false);
  const [asuntoEmail, setAsuntoEmail] = useState(avisoExistente?.asuntoEmail || "");

  const [esRecurrente, setEsRecurrente] = useState(avisoExistente?.esRecurrente || false);
  const [frecuencia, setFrecuencia] = useState(avisoExistente?.frecuencia || "diaria");
  const [horaEjecucion, setHoraEjecucion] = useState(
    avisoExistente?.horaEjecucion ? avisoExistente.horaEjecucion.slice(0, 5) : "09:00"
  );
  const [diaSemana, setDiaSemana] = useState(avisoExistente?.diaSemana ?? 1);
  const [diaMes, setDiaMes] = useState(avisoExistente?.diaMes ?? 1);
  const [programadoPara, setProgramadoPara] = useState("");

  // En modo edicion, si ya hay una imagen guardada se previsualiza pegando
  // directo al endpoint estable del aviso (no hace falta volver a subirla).
  const [mediaPreview, setMediaPreview] = useState(
    avisoExistente?.mediaUrl ? getAvisoMediaUrl(avisoExistente.id) : null
  );
  const [mediaObjectName, setMediaObjectName] = useState(avisoExistente?.mediaUrl || null); // objectName en GCS
  const [mediaContentType, setMediaContentType] = useState(avisoExistente?.tipoMedia || null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showGaleria, setShowGaleria] = useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleMediaSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setMediaPreview(dataUrl);
      setUploadingMedia(true);
      try {
        const result = await uploadAvisoMedia(dataUrl, file.type);
        setMediaObjectName(result.mediaUrl);
        setMediaContentType(result.tipoMedia || file.type);
      } catch (err) {
        setError(err.message || "No se pudo subir la imagen.");
        setMediaPreview(null);
      } finally {
        setUploadingMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMedia = () => {
    setMediaPreview(null);
    setMediaObjectName(null);
    setMediaContentType(null);
  };

  // Elegir una imagen ya subida antes (galeria) — no hace falta subirla de
  // nuevo, solo se referencia el mismo objectName de GCS.
  const handleSelectGaleria = (imagen) => {
    setMediaPreview(getGaleriaImagenUrl(imagen.id));
    setMediaObjectName(imagen.objectName);
    setMediaContentType(imagen.contentType);
    setShowGaleria(false);
  };

  const toggleRol = (value) => {
    setRolesDestino((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!titulo.trim() || !mensajeTexto.trim()) {
      setError("Título y mensaje son obligatorios.");
      return;
    }
    if (rolesDestino.length === 0) {
      setError("Seleccioná al menos un rol destino.");
      return;
    }
    if (!enviarApp && !enviarWhatsapp && !enviarEmail) {
      setError("Activá al menos un canal (App, WhatsApp o Email).");
      return;
    }
    if (esRecurrente && !frecuencia) {
      setError("Un aviso recurrente necesita una frecuencia.");
      return;
    }

    if (uploadingMedia) {
      setError("Esperá a que termine de subirse la imagen.");
      return;
    }

    const payload = {
      titulo: titulo.trim(),
      mensajeTexto: mensajeTexto.trim(),
      mediaUrl: mediaObjectName,
      tipoMedia: mediaContentType,
      rolesDestino,
      enviarApp,
      enviarWhatsapp,
      enviarEmail,
      asuntoEmail: enviarEmail ? asuntoEmail.trim() || null : null,
      esRecurrente,
      frecuencia: esRecurrente ? frecuencia : null,
      horaEjecucion: esRecurrente || programadoPara ? `${horaEjecucion}:00` : null,
      diaSemana: esRecurrente && frecuencia === "semanal" ? Number(diaSemana) : null,
      diaMes: esRecurrente && frecuencia === "mensual" ? Number(diaMes) : null,
      programadoPara: programadoPara ? new Date(programadoPara).toISOString() : null,
    };

    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateAviso(avisoExistente.id, payload);
      } else {
        await createAviso(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || (isEditMode ? "No se pudo guardar el aviso." : "No se pudo crear el aviso."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{isEditMode ? "Editar Aviso" : "Nuevo Aviso"}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Cerrar"
          >
            <X size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Corte de sistema programado"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje</label>
            <textarea
              value={mensajeTexto}
              onChange={(e) => setMensajeTexto(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
              placeholder="Texto del aviso..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Imagen (opcional)</label>
            {mediaPreview ? (
              <div className="relative inline-block">
                <img src={mediaPreview} alt="Preview" className="h-28 w-28 object-cover rounded-lg border border-gray-300 dark:border-gray-700" />
                {uploadingMedia && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleRemoveMedia}
                  className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 hover:bg-rose-700"
                  title="Quitar imagen"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
                  <ImageIcon size={14} />
                  Subir imagen
                  <input type="file" accept="image/*" onChange={handleMediaSelect} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => setShowGaleria(true)}
                  className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <Images size={14} />
                  Elegir de la galería
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Roles destino</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((rol) => (
                <label
                  key={rol.value}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border cursor-pointer ${
                    rolesDestino.includes(rol.value)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={rolesDestino.includes(rol.value)}
                    onChange={() => toggleRol(rol.value)}
                    className="hidden"
                  />
                  {rol.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Canales</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={enviarApp} onChange={(e) => setEnviarApp(e.target.checked)} />
                App (tab Avisos en CONFIRMO + push)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed">
                <input type="checkbox" checked={false} disabled />
                WhatsApp (vía Zavu) — <span className="italic">Próximamente</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={enviarEmail} onChange={(e) => setEnviarEmail(e.target.checked)} />
                Email (vía Zavu)
              </label>
            </div>
          </div>

          {enviarEmail && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asunto del email</label>
              <input
                type="text"
                value={asuntoEmail}
                onChange={(e) => setAsuntoEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                placeholder="Si se deja vacío, se usa el título"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Programar para (opcional, vacío = enviar ahora)
            </label>
            <input
              type="datetime-local"
              value={programadoPara}
              onChange={(e) => setProgramadoPara(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <input type="checkbox" checked={esRecurrente} onChange={(e) => setEsRecurrente(e.target.checked)} />
              Aviso recurrente
            </label>

            {esRecurrente && (
              <div className="space-y-3 pl-6">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Frecuencia</label>
                  <select
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
                  >
                    {FRECUENCIAS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hora de envío</label>
                  <input
                    type="time"
                    value={horaEjecucion}
                    onChange={(e) => setHoraEjecucion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
                  />
                </div>

                {frecuencia === "semanal" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Día de la semana</label>
                    <select
                      value={diaSemana}
                      onChange={(e) => setDiaSemana(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
                    >
                      {DIAS_SEMANA.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {frecuencia === "mensual" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Día del mes</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={diaMes}
                      onChange={(e) => setDiaMes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingMedia}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {isEditMode ? "Guardar cambios" : "Crear Aviso"}
            </button>
          </div>
        </form>
      </motion.div>

      {showGaleria && (
        // stopPropagation: este modal esta anidado dentro del backdrop del
        // formulario (que cierra todo con onClose al click afuera) — sin
        // esto, cerrar la galeria tambien cerraria el formulario entero.
        <div onClick={(e) => e.stopPropagation()}>
          <AvisoGaleriaPicker onClose={() => setShowGaleria(false)} onSelect={handleSelectGaleria} />
        </div>
      )}
    </div>
  );
};

export default AvisoFormModal;
