// Paleta "silenciada" (pastel) a propósito: el color de ESTADO del depósito
// (borde izquierdo de la card, ver DepositCard.jsx) ya es la señal fuerte y
// saturada. Antes este badge usaba colores sólidos (bg-*-600) que competían
// con ese borde -- un depósito de Scotiabank en la columna Rechazado
// (borde rojo) quedaba con DOS rojos saturados sin relación entre sí, dando
// falsa sensación de "doble alerta". Bajar la saturación acá mantiene el
// reconocimiento rápido por color/texto sin pisarle el protagonismo al
// indicador de estado, que es el que de verdad importa para el triage.
const BANK_COLOR_RULES = [
  {
    match: /bcp|credito/i,
    className:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
  {
    match: /bbva/i,
    className:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  {
    match: /interbank|ibk/i,
    className:
      "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-800",
  },
  {
    match: /scotia/i,
    className:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  },
  {
    match: /banbif|bif/i,
    className:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
  },
  {
    match: /pichincha/i,
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  },
];

const DEFAULT_BANK_CLASSNAME =
  "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600";

export function getBankBadgeClassName(banco) {
  const label = `${banco?.abreviatura || ""} ${banco?.nombre || ""}`.trim();
  if (!label) return DEFAULT_BANK_CLASSNAME;

  const rule = BANK_COLOR_RULES.find(({ match }) => match.test(label));
  return rule ? rule.className : DEFAULT_BANK_CLASSNAME;
}

export default getBankBadgeClassName;
