/**
 * Helpers para pintar los campos monto/moneda/fecha_deposito según el
 * resultado del chequeo cruzado OCR (Vision) vs. IA (LlamaCloud) que hace
 * el worker Python y que llega en deposit.datos_ocr.verificacion.
 *
 * Ver D:\ocr-crosscheck-test\ocr_utils.py (resolver_campo) para el origen
 * de estos 4 valores de "accion". Random note: esto vive en fronted/,
 * NO en api-worker ni api-bridge, así que se puede editar directo acá.
 */

// El modificador `!` mantiene visible la verificación incluso cuando el campo
// está deshabilitado y también recibe clases como `disabled:bg-gray-100`.
const CLASES_POR_ACCION = {
  ninguna:
    "!border-green-400 !bg-green-50 dark:!border-green-600 dark:!bg-green-900/25",
  revision_manual:
    "!border-red-400 !bg-red-50 dark:!border-red-600 dark:!bg-red-900/30",
  auto_corregido:
    "!border-amber-400 !bg-amber-50 dark:!border-amber-600 dark:!bg-amber-900/30",
};

const CLASE_DEFAULT =
  "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700";

// Variante "compacta" usada en el bloque inline de DepositDetailModal.jsx
// (rounded-xl en vez de rounded-lg, mismo criterio de color).
const CLASES_COMPACT_POR_ACCION = {
  ...CLASES_POR_ACCION,
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
  if (verificacionCampo.accion === "ninguna") {
    return verificacionCampo.motivo || "Valor verificado: Llama y OCR coinciden.";
  }
  if (verificacionCampo.accion === "revision_manual") {
    return verificacionCampo.motivo || "Revisar: Llama y OCR obtuvieron valores diferentes.";
  }
  if (verificacionCampo.accion === "auto_corregido") {
    return verificacionCampo.motivo || "Llama no obtuvo el valor; se utilizó el candidato OCR.";
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
