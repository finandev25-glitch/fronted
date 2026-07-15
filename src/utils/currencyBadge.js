// Estilo de la píldora de moneda mostrada junto al monto en cada card.
const CURRENCY_STYLES = {
  USD: {
    label: "USD",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  },
  PEN: {
    label: "S/",
    className:
      "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  },
};

const DEFAULT_CLASSNAME =
  "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600";

/**
 * Devuelve la etiqueta y clases de la píldora para una moneda.
 * @param {string} moneda - código de moneda (ej. "USD", "PEN")
 * @returns {{ label: string, className: string }}
 */
export function getCurrencyBadge(moneda) {
  const code = String(moneda || "").toUpperCase();
  const style = CURRENCY_STYLES[code];
  return {
    label: style?.label || code || "N/A",
    className: style?.className || DEFAULT_CLASSNAME,
  };
}

export default getCurrencyBadge;
