import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Trash2, ImageOff } from "lucide-react";
import { fetchGaleriaImagenes, deleteGaleriaImagen, getGaleriaImagenUrl } from "../features/avisos/api/avisosApi.js";
import { useEscapeClose } from "../hooks/useEscapeClose.js";

// Modal para elegir una imagen ya subida anteriormente (galeria) en vez de
// subir una nueva cada vez. Cada imagen adjuntada a un aviso queda guardada
// aca automaticamente (ver POST /avisos/media en el backend).
const AvisoGaleriaPicker = ({ onClose, onSelect }) => {
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEscapeClose(onClose);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchGaleriaImagenes();
      setImagenes(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la galería.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("¿Quitar esta imagen de la galería? No afecta a los avisos que ya la usan.")) return;
    setDeletingId(id);
    try {
      await deleteGaleriaImagen(id);
      setImagenes((prev) => prev.filter((img) => img.id !== id));
    } catch (err) {
      alert(err.message || "No se pudo borrar la imagen.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Elegir de la galería</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Cerrar"
          >
            <X size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Cargando...
          </div>
        ) : imagenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <ImageOff size={28} className="mb-2" />
            Todavía no hay imágenes subidas.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {imagenes.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => onSelect(img)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-500 focus:outline-none"
                title={img.nombre || "Sin nombre"}
              >
                <img
                  src={getGaleriaImagenUrl(img.id)}
                  alt={img.nombre || "Imagen de galería"}
                  className="w-full h-full object-cover"
                />
                {img.nombre && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1.5 py-1 truncate">
                    {img.nombre}
                  </div>
                )}
                <span
                  role="button"
                  onClick={(e) => handleDelete(e, img.id)}
                  className="absolute top-1 right-1 bg-black/55 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-opacity"
                  title="Quitar de la galería"
                >
                  {deletingId === img.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </span>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AvisoGaleriaPicker;
