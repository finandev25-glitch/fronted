import React, { useEffect, useRef, useState } from "react";
import { X, UploadCloud, Loader2, CheckCircle, AlertCircle } from "lucide-react";

// Modal minimo para que finanzas/admin suba la imagen/pdf nueva de un
// deposito que ya fue marcado como "pendiente regularizar" (ver
// DepositsTable/TablePage -> markDepositForRegularize). A diferencia del
// formulario de regularizacion del vendedor (RegularizarDepositos, exige
// Estado="rechazado" y SI vuelve a pasar por el worker de IA), esto solo
// reemplaza el archivo: el backend (PUT /finance-regularize-image) no toca
// el Estado del deposito ni lo encola de nuevo para el python-worker.
export default function RegularizeImageModal({ deposit, onClose, onSubmit }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const loadFile = (selected) => {
    setError("");
    setPreview("");

    if (!selected) {
      setFile(null);
      return;
    }

    if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
      setError("Selecciona una imagen o un PDF valido.");
      setFile(null);
      return;
    }

    setFile(selected);

    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result || ""));
      reader.readAsDataURL(selected);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    loadFile(selected);
    e.target.value = "";
  };

  // Permite pegar una captura de pantalla directo del portapapeles
  // (Ctrl+V), sin tener que guardarla primero como archivo -- mismo patron
  // que ya usa el formulario de regularizacion del vendedor
  // (RegularizarDepositos.jsx / handleCroppedImagePaste).
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));

    if (!imageItem) {
      setError("Pega una imagen desde el portapapeles, o haz clic para elegir un archivo.");
      return;
    }

    const pasted = imageItem.getAsFile();
    if (!pasted) {
      setError("No se pudo leer la imagen pegada.");
      return;
    }

    e.preventDefault();
    loadFile(pasted);
  };

  // Pegar el recorte con Ctrl+V en cualquier parte del modal, SIN tener que
  // hacer clic antes en el recuadro. Ignora pegados que no sean imagen.
  useEffect(() => {
    const onWindowPaste = (event) => {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      );
      if (!imageItem) return;
      const pasted = imageItem.getAsFile();
      if (!pasted) return;
      event.preventDefault();
      loadFile(pasted);
    };
    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!file) {
      setError("Selecciona un archivo primero.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
      });

      // El backend (ValidateAndDecodeImage) espera el base64 SIN el prefijo
      // "data:image/png;base64,important" que agrega FileReader.
      const base64 = dataUrl.split(",")[1] || "";
      if (!base64) {
        throw new Error("El archivo no se pudo convertir correctamente.");
      }

      await onSubmit(base64);
    } catch (err) {
      setError(err.message || "No se pudo subir el archivo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Regularizar voucher {deposit?.numero_operacion_banco ? `— Op. ${deposit.numero_operacion_banco}` : ""}
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Sube la nueva imagen o PDF del voucher. Esto solo reemplaza el archivo — no cambia el estado del
          depósito ni lo vuelve a enviar al procesamiento automático.
        </p>

        <div
          tabIndex={0}
          onPaste={handlePaste}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center outline-none transition-colors hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-gray-700 dark:hover:border-purple-500"
        >
          <UploadCloud className="text-gray-400" size={28} />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {file ? file.name : "Haz clic para elegir un archivo"}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            o pega una captura de pantalla con Ctrl+V
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {preview && (
          <img
            src={preview}
            alt="Vista previa"
            className="mt-3 max-h-56 w-full rounded-lg border border-gray-200 object-contain dark:border-gray-700"
          />
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !file}
            className="inline-flex items-center gap-2 rounded bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Subiendo...
              </>
            ) : (
              <>
                <CheckCircle size={16} /> Guardar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
