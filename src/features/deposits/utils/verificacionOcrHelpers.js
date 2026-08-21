/**
 * Helpers para pintar los campos monto/moneda/fecha_deposito según el
 * resultado del chequeo cruzado OCR (Vision) vs. IA (LlamaCloud) que hace
 * el worker Python y que llega en deposit.datos_ocr.verificacion.
 *
 * Ver D:\ocr-crosscheck-test\ocr_utils.py (resolver_campo) para el origen
 * de estos 4 valores de "accion". Random note: esto vive en fronted/,
 * NO en api-worker ni api-bridge, así que se puede editar directo acá.
 */

// Clases de borde/fondo por acción. "ninguna" y "ninguna_confianza_alta" no
// llevan alerta visual -- coincidencia exacta no necesita aviso, y ausencia
// de OCR + confianza alta de la IA no es evidencia de nada malo, solo
// ausencia de datos con que contrastar.
const CLASES_POR_ACCION = {
  revision_manual:
    "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20",
  auto_corregido:
    "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20",
};

const CLASE_DEFAULT =
  "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700";

// Variante "compacta" usada en el bloque inline de DepositDetailModal.jsx
// (rounded-xl en vez de rounded-lg, mismo criterio de color).
const CLASES_COMPACT_POR_ACCION = {
  revision_manual: "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20",
  auto_corregido: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20",
};

const CLASE_COMPACT_DEFAULT = "border-slate-300 bg-white dark:border-gray-700 dark:bg-gray-950";

export function claseSegunAccion(accion, { compact = false } = {}) {
  const mapa = compact ? CLASES_COMPACT_POR_ACCION : CLASES_POR_ACCION;
  const clase = mapa[accion];
  return clase || (compact ? CLASE_COMPACT_DEFAULT : CLASE_DEFAULT);
}

// Texto corto para mostrar como aviso debajo del campo (label o tooltip).
export function motivoVisible(verificacionCampo) {
  if (!verificacionCampo) return "";
  if (verificacionCampo.accion === "revision_manual") {
    return verificacionCampo.motivo || "Revisar: el sistema no pudo confirmar este valor.";
  }
  if (verificacionCampo.accion === "auto_corregido") {
    return verificacionCampo.motivo || "Corregido automáticamente por el OCR.";
  }
  return "";
}

/**
 * verificacionOcr esperado: deposit.datos_ocr?.verificacion, shape:
 *   { monto: {accion, motivo}, moneda: {accion, motivo}, fecha_deposito: {accion, motivo} }
 *
 * OJO: el campo se llama fecha_deposito de punta a punta (así está en
 * voucher_schema_fields en BD, y así lo devuelve LlamaCloud) -- NO
 * fecha_operacion. Hubo confusión con eso porque el modelo estático viejo
 * en app/models/deposit.py (no usado en producción) sí usa fecha_operacion.
 * No hace falta alias acá, la key coincide directo con editableData.
 */
export function campoVerificacion(verificacionOcr, campo) {
  if (!verificacionOcr) return null;
  return verificacionOcr[campo] || null;
}
