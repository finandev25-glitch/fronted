import {
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

/**
 * Configuración centralizada de estados de depósitos
 */
export const depositStatusConfig = {
  procesado: {
    icon: Clock,
    label: "Pendiente",
    color: "text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/50",
    borderColor: "border-l-orange-500",
    gradient: "bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800",
    shadow: "shadow-md dark:shadow-black/30 hover:shadow-lg hover:shadow-orange-500/50 dark:hover:shadow-orange-400/40",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  en_validacion: {
    icon: AlertCircle,
    label: "En Validación",
    color: "text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50",
    borderColor: "border-l-blue-500",
    gradient: "bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800",
    shadow: "shadow-md dark:shadow-black/30 hover:shadow-lg hover:shadow-blue-500/50 dark:hover:shadow-blue-400/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  confirmado: {
    icon: CheckCircle,
    label: "Confirmado",
    color: "text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/50",
    borderColor: "border-l-green-500",
    gradient: "bg-gradient-to-br from-green-50/80 to-white dark:from-green-900/20 dark:to-gray-800",
    shadow: "shadow-md dark:shadow-black/30 hover:shadow-lg hover:shadow-green-500/50 dark:hover:shadow-green-400/40",
    iconColor: "text-green-600 dark:text-green-400",
  },
  rechazado: {
    icon: XCircle,
    label: "Rechazado",
    color: "text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/50",
    borderColor: "border-l-red-500",
    gradient: "bg-gradient-to-br from-red-50/80 to-white dark:from-red-900/20 dark:to-gray-800",
    shadow: "shadow-md dark:shadow-black/30 hover:shadow-lg hover:shadow-red-500/50 dark:hover:shadow-red-400/40",
    iconColor: "text-red-600 dark:text-red-400",
  },
};

/**
 * Determina si un depósito es "antiguo". El backend expone esto vía el campo
 * `condicion === "antiguo"` (se setea cuando la fecha del voucher es anterior
 * a hoy). Se mantiene `es_antiguo` como fallback por si en el futuro se puebla
 * esa columna.
 * @param {{ es_antiguo?: boolean, condicion?: string } | null} deposit
 * @returns {boolean}
 */
export const isDepositAntiguo = (deposit) => {
  if (!deposit) return false;
  if (deposit.es_antiguo === true) return true;
  return String(deposit.condicion || "").toLowerCase() === "antiguo";
};

/**
 * Columna del Kanban a la que pertenece un depósito. El backend no tiene un
 * estado "en_validacion" real: un "procesado" pasa a la columna "En Validación"
 * cuando ya fue tomado (validado_por) O cuando es antiguo (condicion "antiguo"),
 * para que los antiguos entren directo a validación en vez de quedarse en
 * "Pendiente". El resto conserva su estado tal cual.
 * @param {{ estado?: string, validado_por?: any, es_antiguo?: boolean, condicion?: string }} deposit
 * @returns {string} id de columna ("procesado" | "en_validacion" | "confirmado" | "rechazado" | ...)
 */
export const getKanbanBucket = (deposit) => {
  if (
    deposit?.estado === "procesado" &&
    (deposit.validado_por || isDepositAntiguo(deposit))
  ) {
    return "en_validacion";
  }
  return deposit?.estado;
};

/**
 * Obtiene la información de estilo para un estado de depósito
 * @param {string} estado - Estado del depósito
 * @returns {Object} Configuración de estilo
 */
export const getStatusInfo = (estado) => {
  return depositStatusConfig[estado] || {
    icon: Clock,
    label: "Desconocido",
    color: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700",
    borderColor: "border-l-gray-500",
    gradient: "bg-gradient-to-br from-gray-50/80 to-white dark:from-gray-900/20 dark:to-gray-800",
    shadow: "shadow-md dark:shadow-black/30 hover:shadow-lg hover:shadow-gray-500/50 dark:hover:shadow-gray-400/40",
    iconColor: "text-gray-600 dark:text-gray-400",
  };
};

/**
 * Obtiene solo el icono para un estado
 * @param {string} estado - Estado del depósito
 * @returns {React.Component} Componente del icono
 */
export const getStatusIcon = (estado) => {
  return depositStatusConfig[estado]?.icon || Clock;
};

/**
 * Obtiene solo el label para un estado
 * @param {string} estado - Estado del depósito
 * @returns {string} Label del estado
 */
export const getStatusLabel = (estado) => {
  return depositStatusConfig[estado]?.label || "Desconocido";
};

/**
 * Obtiene los estilos de borde para un estado
 * @param {string} estado - Estado del depósito
 * @returns {string} Clases CSS de borde
 */
export const getStatusBorder = (estado) => {
  return depositStatusConfig[estado]?.borderColor || "border-l-gray-500";
};

export default {
  depositStatusConfig,
  getStatusInfo,
  getStatusIcon,
  getStatusLabel,
  getStatusBorder,
  isDepositAntiguo,
  getKanbanBucket,
};
