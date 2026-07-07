import { toLocalISOString } from "../../../../utils/dateFormatters";

export const KANBAN_COLUMNS = [
  { id: "recibido", title: "Pendiente", color: "bg-orange-400" },
  { id: "en_validacion", title: "En Validación", color: "bg-blue-400" },
  { id: "validado", title: "Validado", color: "bg-green-400" },
  { id: "rechazado", title: "Rechazado", color: "bg-red-400" },
];

export function normalizeAmountInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getSelectedDateFilter(filterDateOption, specificDate) {
  if (filterDateOption === "specific") return specificDate;
  if (filterDateOption === "today") return toLocalISOString(new Date());
  return null;
}
