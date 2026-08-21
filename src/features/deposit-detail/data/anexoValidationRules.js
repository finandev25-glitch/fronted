/**
 * anexoValidationRules.js
 *
 * Tabla de validación Empresa+Anexo -> qué texto debería aparecer en el
 * voucher/página del banco (columnas "EMPRESA A VALIDAR" y "DATO A VALIDAR"
 * de Validacion.xlsx, hoja "DATOS"). Generada a mano a partir de ese Excel
 * -- si el Excel cambia, hay que volver a copiar los datos acá y desplegar
 * de nuevo (esto es un sitio web: no puede leer un .xlsx del disco del
 * usuario en tiempo de ejecución).
 *
 * Usada por useDepositActions.js (handleCheckDuplicates): antes de buscar
 * duplicados, si la combinación Empresa+Anexo elegida tiene una fila acá, se
 * busca empresaValidar y datoValidar en la pestaña activa (mismo mecanismo
 * que "Buscar importe"/"Buscar nro. operación", ver activeTabSearch.js) --
 * si no se encuentra alguno de los dos, se bloquea con un error en vez de
 * dejar seguir a "Comprobar Duplicados"/"Confirmar".
 */
export const ANEXO_VALIDATION_RULES = [
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "YCREDMN",
    empresaValidar: "J.CH.COMERCIAL S.A.",
    datoValidar: "Corriente Soles 191-6661277-0-24",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "LCRED ME",
    empresaValidar: "J.CH.COMERCIAL S.A.",
    datoValidar: "Corriente Dólares 193-9948591-1-26",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "LCRED MN",
    empresaValidar: "J.CH.COMERCIAL S.A.",
    datoValidar: "Corriente Soles 193-9945454-0-29",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "CREDI ME",
    empresaValidar: "J.CH.COMERCIAL S.A.",
    datoValidar: "Corriente Dólares 540-0051071-1-23",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "CREDI MN",
    empresaValidar: "J.CH.COMERCIAL S.A.",
    datoValidar: "Corriente Soles 540-0051072-0-23",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "RECAU MN",
    empresaValidar: "J.CH.COMERCIAL S.A.",
    datoValidar: "Corriente Soles 540-1187644-0-47",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "RECAU ME",
    empresaValidar: "J.CH.COMERCIAL S.A.",
    datoValidar: "Corriente Dólares 540-1188858-1-19",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "YCREDMN",
    empresaValidar: "EVOLUTION CAR SERVICE EIRL",
    datoValidar: "Corriente Soles 191-6661334-0-00",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "LCRED MN",
    empresaValidar: "EVOLUTION CAR SERVICE EIRL",
    datoValidar: "Corriente Soles 193-9951933-0-73",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "LCRED ME",
    empresaValidar: "EVOLUTION CAR SERVICE EIRL",
    datoValidar: "Corriente Dólares 193-9953618-1-03",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "CREDI MN",
    empresaValidar: "EVOLUTION CAR SERVICE EIRL",
    datoValidar: "Corriente Soles 540-1588073-0-85",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "CREDI ME",
    empresaValidar: "EVOLUTION CAR SERVICE EIRL",
    datoValidar: "Corriente Dólares 540-1599931-1-72",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "CONTI ME",
    empresaValidar: "J CH COMERCIAL SA",
    datoValidar: "Nº de la Cuenta: 0011-0232-01-00047073 - CUENTA CORRIENTE",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "CONTI MN",
    empresaValidar: "J CH COMERCIAL SA",
    datoValidar: "Nº de la Cuenta: 0011-0232-01-00047065 - CUENTA CORRIENTE",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "BBVA MN",
    empresaValidar: "EVOLUTION CAR SERVICE EIRL",
    datoValidar: "Nº de la Cuenta: 0011-0409-01-00005410 - CUENTA CORRIENTE",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "BBVA ME",
    empresaValidar: "EVOLUTION CAR SERVICE EIRL",
    datoValidar: "Nº de la Cuenta: 0011-0409-01-00005429 - CUENTA CORRIENTE",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "INTER MN",
    empresaValidar: "J CH COMERCIAL",
    datoValidar: "Corriente Soles 340-0001256733",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "INTER ME",
    empresaValidar: "J CH COMERCIAL",
    datoValidar: "Corriente Dólares 340-0001256732",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "INTER MN",
    empresaValidar: "EVOLUTION CAR SERVICE",
    datoValidar: "Corriente Soles 340-3001121616",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "INTER ME",
    empresaValidar: "EVOLUTION CAR SERVICE",
    datoValidar: "Corriente Dólares 340-3000998246",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "SCOTI MN",
    empresaValidar: "J.CH. COMERCIAL S.A.",
    datoValidar: "Cuenta Corriente CCMN 258-1030020",
  },
  {
    empresaSeleccionado: "JCH COMERCIAL SA",
    anexoSeleccionado: "SCOTI ME",
    empresaValidar: "J.CH. COMERCIAL S.A.",
    datoValidar: "Cuenta Corriente CCME 258-1030021",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "SCOTI MN",
    empresaValidar: "EVOLUTION CAR SERVIC",
    datoValidar: "Cuenta Corriente CCMN 000-2558512",
  },
  {
    empresaSeleccionado: "EVOLUTION CAR SERVICE EIRL",
    anexoSeleccionado: "SCOTI ME",
    empresaValidar: "EVOLUTION CAR SERVIC",
    datoValidar: "Cuenta Corriente CCME 000-5155551",
  },
];

const normalizeKey = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

export function findAnexoValidationRule(empresaNombre, anexo) {
  const empresaKey = normalizeKey(empresaNombre);
  const anexoKey = normalizeKey(anexo);
  if (!empresaKey || !anexoKey) return null;
  return (
    ANEXO_VALIDATION_RULES.find(
      (rule) =>
        normalizeKey(rule.empresaSeleccionado) === empresaKey &&
        normalizeKey(rule.anexoSeleccionado) === anexoKey,
    ) || null
  );
}

export default ANEXO_VALIDATION_RULES;
