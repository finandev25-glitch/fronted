import React, { useState, useEffect, memo } from "react";
import {
  Building2,
  User,
  Phone,
  MessageSquare,
  Clock,
  Hourglass,
  AlertTriangle,
} from "lucide-react";
import {
  getStatusInfo,
  getKanbanBucket,
  isDepositAntiguo,
} from "../utils/depositStatusHelpers";
import { formatDate, formatShortDateFromDateOnly } from "../utils/dateFormatters";
import { getBankBadgeClassName } from "../utils/bankColors";
import { getCompanyLogo } from "../utils/companyLogos";
import { getCurrencyBadge } from "../utils/currencyBadge";

const DepositCard = ({ deposit, onClick, isSelected = false }) => {
  const [elapsedTime, setElapsedTime] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      if (!deposit.fecha_registro) return;
      const now = new Date();
      const registeredAt = new Date(deposit.fecha_registro);
      const diffMs = now - registeredAt;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);

      if (diffMins > 60) {
        setElapsedTime("+60 min");
      } else {
        // Mostrar segundos si el estado es "pendiente" o "en_validacion"
        if (
          deposit.estado === "recibido" ||
          deposit.estado === "en_validacion"
        ) {
          setElapsedTime(`${diffMins}:${diffSecs.toString().padStart(2, "0")}`);
        } else {
          setElapsedTime(`${diffMins} min`);
        }
      }
    };

    calculateTime();
    // Actualizar cada segundo si es pendiente o en_validacion, cada minuto si no
    const interval =
      deposit.estado === "recibido" || deposit.estado === "en_validacion"
        ? 1000
        : 60000;
    const intervalId = setInterval(calculateTime, interval);

    return () => clearInterval(intervalId);
  }, [deposit.fecha_registro, deposit.estado]);

  const getUserInitials = (name) => {
    if (!name || typeof name !== "string") return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Mismo criterio visual que KanbanPage.groupedDeposits: el backend no tiene
  // un estado "en_validacion" real. getKanbanBucket lo deriva (procesado +
  // validado_por, o procesado antiguo) para que la card tome el color correcto.
  const effectiveEstado = getKanbanBucket(deposit);

  const statusStyles = getStatusInfo(effectiveEstado);

  const companyLogo = deposit.empresa ? getCompanyLogo(deposit.empresa) : null;
  const currencyBadge = getCurrencyBadge(deposit.moneda);

  // Determinar si es un depósito antiguo en validación
  const isOldDeposit =
    isDepositAntiguo(deposit) && effectiveEstado === "en_validacion";
  // Depósito procesado marcado con riesgo -> peligro (parpadeo rojo + ícono).
  const isRiesgo = deposit.estado === "procesado" && deposit.riesgo === true;
  const rejectedObservation =
    deposit.estado === "rechazado"
      ? String(deposit.observaciones || deposit.motivo_rechazo || "").trim()
      : "";

  return (
    <div
      onClick={() => onClick?.(deposit)}
      className={`relative rounded-xl border border-gray-200 dark:border-gray-700/80 border-l-4 ${
        isRiesgo
          ? "border-l-red-600 bg-gradient-to-br from-red-100 to-rose-50 dark:from-red-950/50 dark:to-rose-950/30 shadow-red-300/60 dark:shadow-red-900/50"
          : isOldDeposit
            ? "border-l-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 shadow-orange-200/50 dark:shadow-orange-900/30"
            : `${statusStyles.borderColor} ${statusStyles.gradient} ${statusStyles.shadow}`
      } px-3.5 py-2.5 transition-all duration-300 cursor-pointer flex flex-col h-full ${
        isRiesgo
          ? "danger-blink ring-2 ring-red-400 dark:ring-red-600"
          : isOldDeposit
            ? "ring-2 ring-orange-300 dark:ring-orange-600"
            : ""
      } ${
        isSelected
          ? "ring-2 ring-emerald-300 shadow-[0_0_0_1px_rgba(34,197,94,0.18),0_0_22px_rgba(34,197,94,0.35)] dark:ring-emerald-400 dark:shadow-[0_0_0_1px_rgba(74,222,128,0.22),0_0_24px_rgba(74,222,128,0.28)]"
          : ""
      }`}
    >
      {/* Header: logo empresa, banco | fecha/hora y tiempo transcurrido */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center space-x-2 min-w-0 overflow-hidden">
          {/* Empresa: logo circular si existe, si no las iniciales */}
          {deposit.empresa &&
            (companyLogo ? (
              <img
                src={companyLogo}
                alt={deposit.empresa.nombre}
                title={`Empresa: ${deposit.empresa.nombre}`}
                loading="lazy"
                className="h-12 w-12 flex-shrink-0 rounded-full border border-gray-200 bg-white object-contain p-0.5 shadow-sm dark:border-gray-600 dark:bg-white"
              />
            ) : (
              <span
                className="px-2.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold rounded-lg border border-blue-200 dark:border-blue-700 flex-shrink-0"
                title={`Empresa: ${deposit.empresa.nombre}`}
              >
                {deposit.empresa.nombre
                  .split(" ")
                  .filter((word) => word.length > 2) // Filtrar palabras cortas como "SA", "DE", "LA"
                  .map((word) => word.charAt(0))
                  .join("")
                  .substring(0, 4) // Máximo 4 caracteres
                  .toUpperCase()}
              </span>
            ))}
          {/* Badge para depósitos pendientes de regularizar (voucher a reemplazar) */}
          {deposit.pendiente_regularizar && (
            <span
              className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 text-xs font-bold rounded-md border border-yellow-300 dark:border-yellow-600 flex-shrink-0"
              title="Pendiente de regularizar: reemplazar el voucher por uno válido"
            >
              ⚠️ REG
            </span>
          )}
          {/* Banco */}
          <span
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg border truncate ${getBankBadgeClassName(deposit.banco)}`}
            title={deposit.banco?.abreviatura}
          >
            {deposit.banco?.abreviatura || "N/A"}
          </span>
        </div>
        <div className="flex items-center space-x-2.5 flex-shrink-0">
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock size={13} className={statusStyles.iconColor} />
            <span className="font-medium">
              {formatShortDateFromDateOnly(deposit.fecha_solo_date)}{" "}
              {new Date(deposit.fecha_registro).toLocaleTimeString("es-PE", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "America/Lima"
              })}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            <Hourglass size={13} className="text-amber-500 dark:text-amber-400" />
            <span>{elapsedTime}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow">
        {/* Operación/Fecha & Monto */}
        <div className="mb-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
          <div className="flex flex-col text-sm text-gray-600 dark:text-gray-300 gap-0.5 min-w-0">
            <span className="truncate">Op&nbsp;&nbsp;&nbsp;: {deposit.numero_operacion || "N/A"}</span>
            <span className="truncate">
              Fecha: {formatDate(deposit.fecha_deposito)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {(deposit.monto || 0).toLocaleString("es-ES", {
                minimumFractionDigits: 2,
              })}
            </p>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-xs font-bold ${currencyBadge.className}`}
            >
              {currencyBadge.label}
            </span>
          </div>
        </div>

        {/* Sucursal + Trabajador (izquierda) | Validador (abajo derecha) */}
        <div className="flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
            <div className="flex items-center space-x-2 overflow-hidden min-w-0">
              <Building2
                size={13}
                className="text-gray-400 dark:text-gray-500 flex-shrink-0"
              />
              <span className="truncate font-semibold" title={deposit.sucursal?.nombre}>
                {deposit.sucursal?.nombre || "N/A"}
              </span>
            </div>
            <div className="flex items-center space-x-2 overflow-hidden min-w-0">
              <User
                size={13}
                className="text-gray-400 dark:text-gray-500 flex-shrink-0"
              />
              <span className="truncate" title={deposit.trabajador?.nombre}>
                {deposit.trabajador?.nombre || "N/A"}
              </span>
              {deposit.trabajador?.telefono_origen && (
                <span className="flex items-center text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  <Phone size={11} className="mr-1" />
                  <span className="font-mono">
                    {deposit.trabajador.telefono_origen.startsWith('51')
                      ? deposit.trabajador.telefono_origen.slice(2)
                      : deposit.trabajador.telefono_origen}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Usuario que validó (iniciales), abajo a la derecha. Se muestra
              siempre que exista validado_por_usuario (tomado, confirmado o
              rechazado). No se gatea por estado porque el backend real usa
              procesado/confirmado/rechazado y nunca "en_validacion". */}
          {deposit.validado_por_usuario?.nombre && (
            <div
              className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs flex-shrink-0 ring-1 ring-white shadow-sm dark:ring-gray-800"
              title={`Por: ${deposit.validado_por_usuario.nombre}`}
            >
              {getUserInitials(deposit.validado_por_usuario.nombre)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-y-1.5 text-sm text-gray-600 dark:text-gray-300">
          {/* Usuario que cambió estado (solo rechazado y en validación) */}
          {(deposit.rechazado_por || deposit.en_validacion_por) && (
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 pt-1.5">
              <User size={8} className="flex-shrink-0" />
              {deposit.estado === "rechazado" && deposit.rechazado_por && (
                <span className="text-red-600 truncate">
                  ✗ Rechazado por: {deposit.rechazado_por}
                </span>
              )}
              {deposit.estado === "en_validacion" &&
                deposit.en_validacion_por && (
                  <span className="text-blue-600 truncate">
                    ⏳ En validación por: {deposit.en_validacion_por}
                </span>
              )}
            </div>
          )}

          {rejectedObservation && deposit.estado === "rechazado" && (
            <div
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 mt-1.5"
              title={rejectedObservation}
            >
              <MessageSquare size={10} className="mt-0.5 flex-shrink-0" />
              <span className="min-w-0 truncate">
                Obs: {rejectedObservation}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Indicador de peligro (riesgo): ícono + "Revisar" abajo a la derecha */}
      {isRiesgo && (
        <div
          className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-2 ring-white dark:ring-gray-900"
          title="Depósito con riesgo: revisar"
        >
          <AlertTriangle size={12} />
          <span>Revisar</span>
        </div>
      )}
    </div>
  );
};

// Memoizar el componente para evitar re-renders innecesarios
const MemoizedDepositCard = memo(DepositCard, (prevProps, nextProps) => {
  // IMPORTANTE: Retornar TRUE significa NO re-renderizar
  // Retornar FALSE significa SÍ re-renderizar

  // Si CUALQUIERA de estos campos cambió, RE-RENDERIZAR (return false)
  const shouldNotRerender =
    prevProps.deposit.id === nextProps.deposit.id &&
    prevProps.deposit.estado === nextProps.deposit.estado &&
    prevProps.deposit.monto === nextProps.deposit.monto &&
    prevProps.deposit.fecha_registro === nextProps.deposit.fecha_registro &&
    prevProps.deposit.validado_por === nextProps.deposit.validado_por &&
    prevProps.deposit.rechazado_por === nextProps.deposit.rechazado_por &&
    prevProps.deposit.observaciones === nextProps.deposit.observaciones &&
    prevProps.deposit.en_validacion_por ===
      nextProps.deposit.en_validacion_por &&
    prevProps.deposit.es_antiguo === nextProps.deposit.es_antiguo &&
    prevProps.deposit.condicion === nextProps.deposit.condicion &&
    prevProps.deposit.riesgo === nextProps.deposit.riesgo &&
    prevProps.deposit.pendiente_regularizar ===
      nextProps.deposit.pendiente_regularizar &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.deposit.trabajador?.telefono_origen ===
      nextProps.deposit.trabajador?.telefono_origen;

  return shouldNotRerender;
});

MemoizedDepositCard.displayName = "DepositCard";

export default MemoizedDepositCard;
