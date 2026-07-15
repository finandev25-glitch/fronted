const BANK_COLOR_RULES = [
  {
    match: /bcp|credito/i,
    className:
      "bg-orange-600 text-white border-orange-700 dark:bg-orange-500 dark:border-orange-600 dark:text-white",
  },
  {
    match: /bbva/i,
    className:
      "bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 dark:text-white",
  },
  {
    match: /interbank|ibk/i,
    className:
      "bg-lime-400 text-lime-950 border-lime-600 dark:bg-lime-400 dark:text-lime-950 dark:border-lime-500",
  },
  {
    match: /scotia/i,
    className:
      "bg-red-600 text-white border-red-700 dark:bg-red-500 dark:border-red-600 dark:text-white",
  },
  {
    match: /banbif|bif/i,
    className:
      "bg-sky-500 text-white border-sky-600 dark:bg-sky-400 dark:border-sky-500 dark:text-sky-950",
  },
  {
    match: /pichincha/i,
    className:
      "bg-yellow-400 text-yellow-950 border-yellow-600 dark:bg-yellow-400 dark:text-yellow-950 dark:border-yellow-500",
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
