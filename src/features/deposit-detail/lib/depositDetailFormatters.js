export function formatDepositDateTime(isoString) {
  if (!isoString) return "-";

  return new Date(isoString).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatCompactMoney(value) {
  const numericValue = Number(value) || 0;

  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}
