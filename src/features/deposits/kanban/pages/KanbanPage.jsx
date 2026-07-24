import React, {
  useState,
  useMemo,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import DepositCard from "../../../../entities/deposit/ui/DepositCard.jsx";
import DepositDetailModal from "../../../../features/deposit-detail/ui/DepositDetailModal.jsx";
import ContactosModal from "../../../../features/deposit-contacts/ui/ContactosModal.jsx";
import { AuthContext } from "../../../auth/context/AuthContext.jsx";
import { toLocalISOString } from "../../../../utils/dateFormatters";
import {
  saveOpenDepositId,
  clearOpenDepositId,
  restoreOpenDeposit,
  PERSISTENCE_CONFIG,
} from "../../../../utils/persistenceHelpers";
import { KanbanToolbar } from "../../../../widgets/deposits-kanban-board/ui/KanbanToolbar.jsx";
import { KanbanColumns } from "../../../../widgets/deposits-kanban-board/ui/KanbanColumns.jsx";
import { fetchDepositById } from "../../api/depositsApi.js";
import { useDepositQueue } from "../../hooks/useDepositQueue.js";
import { useDepositLockTimer } from "../../hooks/useDepositLockTimer.js";
import { ListChecks, ChevronRight } from "lucide-react";
import {
  getKanbanBucket,
  isDepositAntiguo,
} from "../../../../utils/depositStatusHelpers";
import {
  KANBAN_COLUMNS as KANBAN_COLUMN_DEFS,
  getSelectedDateFilter,
} from "../../../../widgets/deposits-kanban-board/lib/kanbanHelpers.js";

const ColumnContent = ({ deposits, onCardClick, selectedDepositId }) => {
  if (!deposits || deposits.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8 px-4">
        <p className="text-sm">No hay depósitos en este estado.</p>
      </div>
    );
  }
  return (
    <AnimatePresence>
      {deposits.map((deposit) => (
        <motion.div
          key={deposit.id}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <DepositCard
            deposit={deposit}
            onClick={() => onCardClick(deposit)}
            isSelected={selectedDepositId === deposit.id}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
};

const normalizeAmountInput = (value) => {
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
};

const KanbanPage = ({
  deposits,
  onUpdateDeposit,
  onTakeDeposit,
  onUnlockDeposit,
  onFetchDepositsByDate,
  onFetchAllDeposits,
  onSelectedDateChange,
  onSelectDate,
  empresas,
  bancos,
  cuentas,
  sucursales,
  personal,
  onOpenVoucherWindow,
  connectionStatus,
  showConnectionStatus = true,
  realtimeActivity,
  workloadAlarmActive = false,
  pendingWorkloadCount = 0,
  workloadThreshold = 12,
  onRequestReplacementHelp = () => {},
  replacementRequestState = {},
  detailPresentationMode = "default",
}) => {
  const { currentUser, users } = useContext(AuthContext);
  const depositQueue = useDepositQueue({
    deposits,
    cuentas,
    bancos,
    currentUser,
    onTakeDeposit,
    onUnlockDeposit,
  });
  // Candado con vencimiento de 4 min: libera proactivamente mis propios
  // depósitos tomados si se pasaron de tiempo sin confirmar (ver
  // useDepositLockTimer.js -- el respaldo real vive en el backend).
  useDepositLockTimer({
    deposits,
    currentUser,
    onUnlockDeposit,
    removeFromQueue: depositQueue.removeFromQueue,
  });
  // Marca si el depósito actualmente abierto se abrió desde el flujo de "cola
  // de atendidos" (botón "Confirmar siguiente marcado"), para saber si
  // corresponde saltar automáticamente al próximo tras confirmarlo.
  const queueFlowActiveRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [amountSearch, setAmountSearch] = useState("");
  const [branchPersonSearch, setBranchPersonSearch] = useState("");
  const [filterDateOption, setFilterDateOption] = useState("specific");
  const [specificDate, setSpecificDate] = useState(() => {
    const fecha = toLocalISOString(new Date());
    console.log("🎯 KANBAN: specificDate inicializado con:", fecha);
    console.log("🎯 KANBAN: fecha actual (new Date()):", new Date());
    console.log("🎯 KANBAN: toLocalISOString result:", fecha);
    return fecha;
  });
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const selectedDepositRef = useRef(null);
  const modalOpenTimeRef = useRef(0);
  const hasRestoredRef = useRef(false);

  // Estados para colapsar/expandir secciones de "En Validación"
  const [showNormales, setShowNormales] = useState(true);
  const [showAntiguos, setShowAntiguos] = useState(true);

  // Estados para colapsar/expandir secciones de "Pendiente"
  const [showPendientesEspeciales, setShowPendientesEspeciales] =
    useState(true);
  const [showPendientesOtros, setShowPendientesOtros] = useState(true);

  // Estado para modal de contactos
  const [showContactosModal, setShowContactosModal] = useState(false);
  const [selectedValidatorFilter, setSelectedValidatorFilter] = useState(null);
  const isCompactKanban = detailPresentationMode === "compact";

  const getUserInitials = useCallback((name) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return "??";

    return (
      cleanName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "??"
    );
  }, []);

  // Fetch deposits cuando cambia la fecha específica (incluyendo montaje inicial)
  useEffect(() => {
    console.log("🔄 KANBAN useEffect ejecutado:", {
      onFetchDepositsByDate: !!onFetchDepositsByDate,
      filterDateOption,
      specificDate,
    });

    const loadDate = onSelectDate || onFetchDepositsByDate;
    if (!loadDate) {
      console.log("⚠️ KANBAN: no hay handler para cargar depósitos por fecha");
      return;
    }

    if (filterDateOption === "specific" && specificDate) {
      console.log(
        "🔄 KANBAN: Solicitando depósitos para fecha específica:",
        specificDate,
      );
      loadDate(specificDate);
    } else if (filterDateOption === "today") {
      const today = toLocalISOString(new Date());
      console.log("🔄 KANBAN: Solicitando depósitos para hoy:", today);
      loadDate(today);
    } else if (filterDateOption === "all") {
      console.log(
        "🔄 KANBAN: Opción 'Cualquier fecha' seleccionada - cargando TODOS los depósitos",
      );
      if (onSelectDate) {
        onSelectDate(null);
      } else if (onFetchAllDeposits) {
        onFetchAllDeposits();
      } else {
        console.warn("⚠️ KANBAN: onFetchAllDeposits no está disponible");
      }
    } else {
      console.log(
        "⚠️ KANBAN: No se cumple ninguna condición para cargar depósitos. filterDateOption:",
        filterDateOption,
        "specificDate:",
        specificDate,
      );
    }
  }, [
    specificDate,
    filterDateOption,
    onSelectDate,
    onFetchDepositsByDate,
    onFetchAllDeposits,
  ]);

  // Notificar a App cuando cambie la fecha seleccionada
  useEffect(() => {
    if (onSelectedDateChange && specificDate) {
      console.log(
        "📅 KANBAN: Notificando cambio de fecha a App:",
        specificDate,
      );
      onSelectedDateChange(specificDate);
    }
  }, [specificDate, onSelectedDateChange]);

  // Mantener ref actualizada y registrar tiempo de apertura
  useEffect(() => {
    selectedDepositRef.current = selectedDeposit;
    if (selectedDeposit) {
      modalOpenTimeRef.current = Date.now();
      console.log(
        "📂 KANBAN: Modal abierto, guardando en localStorage. ID:",
        selectedDeposit.id,
      );

      // Guardar ID del depósito abierto para restaurar después del reload
      saveOpenDepositId(selectedDeposit.id);
    } else {
      // No limpiar automáticamente localStorage aquí
      // Se limpia explícitamente en handleCloseModal cuando el usuario cierra el modal
      console.log("🔒 KANBAN: Modal cerrado (selectedDeposit es null)");
    }
  }, [selectedDeposit]);

  // Restaurar modal después de page reload
  useEffect(() => {
    // Solo restaurar una vez al cargar
    if (hasRestoredRef.current) return;

    console.log(
      "🔍 KANBAN: Verificando restauración inicial. deposits:",
      deposits?.length,
    );

    if (deposits && deposits.length > 0) {
      const wasRestored = restoreOpenDeposit(
        deposits,
        setSelectedDeposit,
        selectedDeposit,
      );
      hasRestoredRef.current = true;

      if (wasRestored) {
        console.log(
          "✅ KANBAN: Modal restaurado exitosamente en carga inicial",
        );
      } else {
        console.log("ℹ️ KANBAN: No hay modal para restaurar en carga inicial");
      }
    }
  }, [deposits, selectedDeposit]);

  // Monitor deposits prop changes
  useEffect(() => {
    console.log("📊 KANBAN: Prop deposits actualizada:", deposits?.length);
  }, [deposits]);

  // 👁️ Restaurar modal cuando la pestaña vuelve a estar visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log(
          "👁️ KANBAN: Pestaña visible, verificando si hay modal para restaurar",
        );
        restoreOpenDeposit(deposits, setSelectedDeposit, selectedDeposit);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [deposits, selectedDeposit]);

  // Monitorear cambios en selectedDeposit
  useEffect(() => {
    console.log(
      "🔍 KANBAN: selectedDeposit cambió:",
      selectedDeposit
        ? {
            id: selectedDeposit.id,
            estado: selectedDeposit.estado,
            es_antiguo: selectedDeposit.es_antiguo,
          }
        : "null",
    );
  }, [selectedDeposit]);

  // CRÍTICO: Sincronizar selectedDeposit cuando deposits cambia (por Realtime)
  useEffect(() => {
    if (selectedDeposit && deposits && deposits.length > 0) {
      // Buscar la versión actualizada del depósito seleccionado
      const updatedDeposit = deposits.find((d) => d.id === selectedDeposit.id);

      if (updatedDeposit) {
        // Verificar si hay cambios reales
        const hasChanges =
          updatedDeposit.es_antiguo !== selectedDeposit.es_antiguo ||
          updatedDeposit.condicion !== selectedDeposit.condicion ||
          updatedDeposit.estado !== selectedDeposit.estado ||
          updatedDeposit.monto !== selectedDeposit.monto ||
          updatedDeposit.pendiente_regularizar !== selectedDeposit.pendiente_regularizar ||
          updatedDeposit.riesgo !== selectedDeposit.riesgo;

        if (hasChanges) {
          console.log(
            "🔄 KANBAN: Actualizando selectedDeposit con datos de Realtime",
            {
              id: updatedDeposit.id,
              es_antiguo_prev: selectedDeposit.es_antiguo,
              es_antiguo_new: updatedDeposit.es_antiguo,
              estado: updatedDeposit.estado,
            },
          );
          setSelectedDeposit(updatedDeposit);
        }
      }
    }
  }, [deposits, selectedDeposit]);

  // Detectar cambios de visibilidad de la página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log(
          "🟢 KANBAN: Página visible - Los clicks deberían funcionar",
        );
      } else {
        console.log("🔴 KANBAN: Página oculta - Inactividad detectada");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Debounce search term con 300ms de delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredDeposits = useMemo(() => {
    if (!deposits || !Array.isArray(deposits)) {
      console.log(
        "⚠️ KANBAN: No hay deposits o no es array:",
        deposits?.length,
      );
      return [];
    }

    console.log("🔍 KANBAN: Filtrando deposits:", {
      total: deposits.length,
      filterDateOption,
      specificDate,
      searchTerm: debouncedSearchTerm,
    });
    // Debug: mostrar las primeras 5 fechas disponibles
    const fechasDisponibles = deposits.slice(0, 5).map((d) => ({
      id: d.id,
      fecha_solo_date: d.fecha_solo_date,
      fecha_registro: d.fecha_registro?.substring(0, 10),
    }));
    console.log(
      "📅 KANBAN: Fechas disponibles (primeros 5):",
      fechasDisponibles,
    );
    const parsedAmountSearch = normalizeAmountInput(amountSearch);
    const normalizedBranchSearch = branchPersonSearch.toLowerCase().trim();
    const selectedDateFilter = getSelectedDateFilter(
      filterDateOption,
      specificDate,
    );

    const filtered = deposits.filter((deposit) => {
      const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();

      const formattedDateTime = new Date(deposit.fecha_registro).toLocaleString(
        "es-ES",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );

      const matchesSearch =
        !debouncedSearchTerm ||
        (deposit.cliente &&
          deposit.cliente.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (deposit.ruc_cliente &&
          deposit.ruc_cliente.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (deposit.numero_operacion &&
          deposit.numero_operacion
            .toLowerCase()
            .includes(lowerCaseSearchTerm)) ||
        (deposit.sucursal?.nombre &&
          deposit.sucursal.nombre
            .toLowerCase()
            .includes(lowerCaseSearchTerm)) ||
        (deposit.banco?.abreviatura &&
          deposit.banco.abreviatura
            .toLowerCase()
            .includes(lowerCaseSearchTerm)) ||
        (deposit.trabajador?.nombre &&
          deposit.trabajador.nombre
            .toLowerCase()
            .includes(lowerCaseSearchTerm)) ||
        (deposit.moneda &&
          deposit.moneda.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (deposit.monto &&
          deposit.monto.toString().includes(lowerCaseSearchTerm)) ||
        formattedDateTime.includes(lowerCaseSearchTerm);

      const montoValue = Number(deposit.monto);
      const searchAmountText = amountSearch.trim();
      const montoText = deposit.monto != null ? String(deposit.monto) : "";
      const montoFormatted = Number.isFinite(montoValue)
        ? montoValue.toLocaleString("es-ES", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";
      const matchesAmount =
        parsedAmountSearch == null ||
        (Number.isFinite(montoValue) &&
          (montoValue === parsedAmountSearch ||
            montoText.includes(searchAmountText) ||
            montoFormatted.includes(searchAmountText) ||
            montoValue.toFixed(2).includes(parsedAmountSearch.toFixed(2))));

      const matchesBranchPerson =
        !normalizedBranchSearch ||
        (deposit.trabajador?.nombre &&
          deposit.trabajador.nombre.toLowerCase().includes(normalizedBranchSearch)) ||
        (deposit.trabajador?.telefono_origen &&
          deposit.trabajador.telefono_origen.toLowerCase().includes(normalizedBranchSearch));

      const matchesDate =
        !selectedDateFilter || deposit.fecha_solo_date === selectedDateFilter;

      return matchesDate && matchesSearch && matchesAmount && matchesBranchPerson;
    });

    console.log(
      "✅ KANBAN: Resultado filtrado:",
      filtered.length,
      "de",
      deposits.length,
    );
    return filtered;
  }, [deposits, debouncedSearchTerm, amountSearch, branchPersonSearch]);

  const attendedUsersSummary = useMemo(() => {
    const userList = Array.isArray(users) ? users : [];
    const countsByKey = new Map();

    filteredDeposits.forEach((deposit) => {
      const validatorId = deposit?.validado_por ?? deposit?.validado_por_usuario?.id ?? null;
      // OJO: a propósito NO se cae acá a deposit?.validado_por como nombre --
      // eso es el id crudo (GUID), no un nombre para mostrar. Si no se
      // resuelve un nombre real por ningún lado, mejor mostrar "Usuario"
      // (ver `name` abajo) que un GUID en la pantalla. El fix real de fondo
      // es que `users` (AuthContext) ahora se refresca completo apenas hay
      // sesión (ver AppShell.jsx) y no solo al entrar a "/usuarios" -- así
      // resolvedUser encuentra al validador la gran mayoría de las veces.
      const validatorName = String(
        deposit?.validado_por_usuario?.nombre || deposit?.validado_por_nombre || "",
      ).trim();

      if (!validatorId && !validatorName) return;

      const resolvedUser = validatorId
        ? userList.find((user) => String(user.id) === String(validatorId)) || null
        : null;

      const key = String(resolvedUser?.id || validatorId || validatorName.toLowerCase());
      const name = resolvedUser?.nombre || validatorName || resolvedUser?.usuario || "Usuario";

      const current = countsByKey.get(key) || { key, name, count: 0 };
      current.count += 1;
      current.name = name;
      countsByKey.set(key, current);
    });

    return Array.from(countsByKey.values())
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  }, [filteredDeposits, users]);

  const handleValidatorFilterToggle = useCallback((user) => {
    if (!user) return;

    setSelectedValidatorFilter((current) => {
      if (current?.key === user.key) {
        return null;
      }

      return {
        key: user.key,
        name: user.name,
      };
    });
  }, []);

  const clearValidatorFilter = useCallback(() => {
    setSelectedValidatorFilter(null);
  }, []);

  const visibleDeposits = useMemo(() => {
    if (!selectedValidatorFilter) {
      return filteredDeposits;
    }

    const selectedKey = String(selectedValidatorFilter.key || "").toLowerCase();

    return filteredDeposits.filter((deposit) => {
      const validatorId = deposit?.validado_por ?? deposit?.validado_por_usuario?.id ?? null;
      const validatorName = String(
        deposit?.validado_por_usuario?.nombre ||
          deposit?.validado_por_nombre ||
          deposit?.validado_por ||
          "",
      ).trim();

      const depositKey = String(validatorId || validatorName.toLowerCase()).toLowerCase();
      return depositKey === selectedKey;
    });
  }, [filteredDeposits, selectedValidatorFilter]);

  const groupedDeposits = useMemo(() => {
    const grouped = visibleDeposits.reduce((acc, deposit) => {
      // El backend real (Deposito.cs) solo tiene los estados recibido/
      // procesado/rechazado/confirmado — "en_validacion" no existe ahí. Un
      // "procesado" pasa a la columna "En Validación" cuando ya fue tomado
      // (validado_por) O cuando es antiguo (condicion "antiguo"). La regla
      // vive en getKanbanBucket para compartirla con DepositCard.
      const bucket = getKanbanBucket(deposit);

      if (!acc[bucket]) {
        acc[bucket] = [];
      }
      acc[bucket].push(deposit);
      return acc;
    }, {});

    // Ordenar cada grupo
    Object.keys(grouped).forEach((estado) => {
      grouped[estado].sort((a, b) => {
        const dateA = new Date(a.fecha_registro);
        const dateB = new Date(b.fecha_registro);

        // Para "confirmado" y "rechazado": más recientes primero (descendente)
        if (estado === "confirmado" || estado === "rechazado") {
          return dateB - dateA; // Descendente: más recientes arriba
        }

        // Para "pendiente" y "en_validacion": más antiguos primero (ascendente)
        return dateA - dateB; // Ascendente: más antiguos arriba
      });
    });

    return grouped;
  }, [visibleDeposits]);

  // Separar depósitos en validación en normales y antiguos
  const validacionSeparated = useMemo(() => {
    const enValidacion = groupedDeposits["en_validacion"] || [];
    return {
      normales: enValidacion.filter((d) => !isDepositAntiguo(d)),
      antiguos: enValidacion.filter((d) => isDepositAntiguo(d)),
    };
  }, [groupedDeposits]);

  // Separar depósitos pendientes por número de teléfono 981199322
  const pendientesSeparated = useMemo(() => {
    const pendientes = groupedDeposits["procesado"] || [];
    return {
      especiales: pendientes.filter((d) => {
        // Verificar si el trabajador tiene el número específico
        const telefono = d.trabajador?.telefono_origen;
        if (!telefono) return false;

        // Normalizar el teléfono (quitar +51 si lo tiene)
        const telefonoNormalizado = telefono.startsWith("51")
          ? telefono.slice(2)
          : telefono;
        return telefonoNormalizado === "981199322";
      }),
      otros: pendientes.filter((d) => {
        const telefono = d.trabajador?.telefono_origen;
        if (!telefono) return true; // Si no hay teléfono, va a "otros"

        const telefonoNormalizado = telefono.startsWith("51")
          ? telefono.slice(2)
          : telefono;
        return telefonoNormalizado !== "981199322";
      }),
    };
  }, [groupedDeposits]);

  const handleCardClick = useCallback(
    async (deposit) => {
      console.log("👆 KANBAN: Click en card detectado", {
        depositId: deposit.id,
        estado: deposit.estado,
        timestamp: new Date().toISOString(),
      });

      console.log("📂 KANBAN: Abriendo modal de forma optimista");

      // Si este depósito está en la cola de la extensión y el usuario ya
      // corrigió algún campo desde el side panel (fecha, número de
      // operación, importe, moneda, cliente), esos valores editados tienen
      // prioridad sobre los del depósito real -- así "viajan" al formulario
      // del detalle sin que el usuario tenga que volver a tipearlos acá.
      // useDepositForm.js inicializa editableData UNA sola vez por
      // deposit.id leyendo directo de este objeto, así que alcanza con
      // pisar los campos acá antes de abrir el modal.
      //
      // numero_operacion (NO numero_operacion_banco -- vestigio de un
      // sistema anterior que ya no usa ni el backend ni la BD) no es parte
      // de editableData/useDepositForm.js: se lee directo de `deposit` en
      // los lugares de solo lectura (DepositCard, "Nro. Op. Solicitante" en
      // el modal), así que alcanza con pisarlo acá también.
      const queueItem = depositQueue.queueItems.find((item) => item.id === deposit.id);
      const queueEdits = queueItem?.depositData;
      const depositToOpen = queueEdits
        ? {
            ...deposit,
            fecha_deposito: queueEdits.fecha_deposito || deposit.fecha_deposito,
            numero_operacion:
              queueEdits.numero_operacion_solicitante || deposit.numero_operacion,
            monto:
              queueEdits.monto !== undefined && queueEdits.monto !== ""
                ? queueEdits.monto
                : deposit.monto,
            moneda: queueEdits.moneda || deposit.moneda,
            cliente: queueEdits.cliente || deposit.cliente,
            anexo: queueEdits.anexo || deposit.anexo,
            banco_id: queueEdits.bancoId || deposit.banco_id,
          }
        : deposit;

      setSelectedDeposit(depositToOpen);

      // FIX: candado de validacion. El backend no permite que otro usuario
      // confirme/rechace un deposito ya tomado (ValidadoPor seteado), pero el
      // endpoint de lock en si NO revisa si ya esta tomado por alguien mas —
      // asi que la proteccion real vive aqui: si ya vemos "validado_por" de
      // OTRO usuario, ni siquiera intentamos tomarlo (evita pisar el candado).
      const lockedByOther =
        deposit.validado_por &&
        currentUser &&
        String(deposit.validado_por).toLowerCase() !== String(currentUser.id).toLowerCase();

      if (lockedByOther) {
        console.log("🔒 KANBAN: Depósito ya tomado por otro usuario, se abre solo lectura");
      } else if (deposit.estado === "procesado" && !deposit.validado_por && currentUser) {
        console.log("🔄 KANBAN: Es pendiente y esta libre, llamando onTakeDeposit (lock real)...");
        console.log("⏳ KANBAN: Esperando respuesta del servidor...");

        // IMPORTANTE: el candado (POST /lock) se espera ANTES de pedir el
        // detalle completo (GET /v1/deposits/{id}), no en paralelo. Antes
        // ambas llamadas salian al mismo tiempo: si el GET (una simple
        // lectura) tardaba mas en resolver que el POST /lock, su respuesta
        // reflejaba el estado de ANTES del candado (validadoPor: null) y
        // terminaba pisando -por orden de llegada, no por cual dato era mas
        // reciente- el validado_por correcto que ya habia puesto el lock.
        // Al secuenciar (lock primero, detalle despues), el GET siempre se
        // dispara una vez que el candado ya quedo confirmado en la BD.
        const startTime = Date.now();
        const updatedDeposit = await onTakeDeposit(deposit);
        const endTime = Date.now();

        console.log(
          `⏱️ KANBAN: onTakeDeposit completado en ${endTime - startTime}ms`,
        );
        console.log("📦 KANBAN: Resultado de onTakeDeposit:", {
          success: !!updatedDeposit,
          id: updatedDeposit?.id,
          validado_por: updatedDeposit?.validado_por,
        });

        if (updatedDeposit) {
          console.log("✅ KANBAN: Sincronizando modal con depósito actualizado (candado tomado)");
          setSelectedDeposit((prev) =>
            prev && prev.id === deposit.id ? { ...prev, ...updatedDeposit } : prev
          );
        } else {
          console.error(
            "❌ KANBAN: onTakeDeposit devolvió null/undefined - el modal ya fue abierto, pero la toma falló (el hook ya mostró el motivo)",
          );
        }
      }

      console.log("🌐 KANBAN: Consultando detalle completo GET /v1/deposits/{id}");
      fetchDepositById(deposit.id)
        .then((fullDeposit) => {
          if (!fullDeposit) return;
          setSelectedDeposit((prev) => {
            if (!prev || prev.id !== deposit.id) return prev;
            // Reaplicar las ediciones de la cola encima del detalle completo
            // recién llegado: si no, fullDeposit (valores reales del backend)
            // pisaría lo que el usuario corrigió en el side panel.
            return {
              ...prev,
              ...fullDeposit,
              ...(queueEdits
                ? {
                    fecha_deposito: queueEdits.fecha_deposito || fullDeposit.fecha_deposito,
                    numero_operacion:
                      queueEdits.numero_operacion_solicitante || fullDeposit.numero_operacion,
                    monto:
                      queueEdits.monto !== undefined && queueEdits.monto !== ""
                        ? queueEdits.monto
                        : fullDeposit.monto,
                    moneda: queueEdits.moneda || fullDeposit.moneda,
                    cliente: queueEdits.cliente || fullDeposit.cliente,
                    anexo: queueEdits.anexo || fullDeposit.anexo,
                    banco_id: queueEdits.bancoId || fullDeposit.banco_id,
                  }
                : null),
            };
          });
        })
        .catch((error) => {
          console.warn("⚠️ KANBAN: No se pudo obtener el detalle completo del deposito:", error);
        });

      console.log("🎬 KANBAN: Fin de handleCardClick");
    },
    [currentUser, onTakeDeposit, depositQueue],
  );

  // Abre el modal del primer depósito marcado como "atendido" en la cola
  // (extensión) que todavía esté presente en el listado -- botón "Confirmar
  // siguiente marcado" del banner de la cola.
  const handleOpenNextQueued = useCallback(() => {
    const nextId = depositQueue.attendedQueueIds[0];
    if (!nextId) return;

    const found = (deposits || []).find((d) => d.id === nextId);
    if (!found) {
      // El depósito ya no está en el listado local (p. ej. se filtró o ya no
      // existe) -- se quita de la cola para no dejar un marcado fantasma.
      depositQueue.removeFromQueue(nextId);
      return;
    }

    queueFlowActiveRef.current = true;
    void handleCardClick(found);
  }, [depositQueue, deposits, handleCardClick]);

  // Envuelve onUpdateDeposit: cuando un depósito que estaba en la cola llega
  // a un estado final (confirmado O rechazado), lo saca de la cola y, si el
  // modal se abrió desde el flujo de "Confirmar siguiente marcado", salta
  // automáticamente al próximo atendido -- así el usuario no tiene que
  // volver a buscarlo manualmente cada vez. Antes solo se sacaba de la cola
  // al confirmar; un rechazo dejaba el item fantasma en el panel lateral
  // aunque el depósito ya hubiera cambiado de estado.
  const handleUpdateDepositFromModal = useCallback(
    (updatedDeposit, options) => {
      onUpdateDeposit(updatedDeposit, options);

      const isFinalState =
        updatedDeposit?.estado === "confirmado" || updatedDeposit?.estado === "rechazado";
      if (!isFinalState) return;
      if (!depositQueue.queuedIds.has(updatedDeposit.id)) return;

      depositQueue.removeFromQueue(updatedDeposit.id);

      if (updatedDeposit.estado === "confirmado" && queueFlowActiveRef.current) {
        queueFlowActiveRef.current = false;
        // El alert() de "Depósito confirmado" (useDepositActions.js) bloquea
        // el hilo hasta que el usuario lo cierra -- este setTimeout igual
        // corre recién después de eso, no hace falta esperar más que un
        // tick para que la UI ya haya asentado el cambio de estado.
        setTimeout(() => {
          const nextId = depositQueue.attendedQueueIds.find((id) => id !== updatedDeposit.id);
          if (!nextId) return;
          const found = (deposits || []).find((d) => d.id === nextId);
          if (found) {
            queueFlowActiveRef.current = true;
            void handleCardClick(found);
          }
        }, 250);
      }
    },
    [onUpdateDeposit, depositQueue, deposits, handleCardClick],
  );

  const handleCloseModal = useCallback(() => {
    const now = Date.now();
    const timeSinceOpen = now - modalOpenTimeRef.current;

    console.log("🚪 KANBAN: handleCloseModal llamado", {
      timeSinceOpen,
      modalOpenTime: modalOpenTimeRef.current,
    });

    // Ignorar cierres que ocurren menos del tiempo mínimo después de abrir
    // Esto previene cierres accidentales/automáticos
    if (timeSinceOpen < PERSISTENCE_CONFIG.MIN_MODAL_OPEN_TIME) {
      console.log("⚠️ KANBAN: Cierre ignorado - modal recién abierto");
      return;
    }

    console.log("🚪 KANBAN: Cerrando modal");

    // Limpiar localStorage ya que el usuario cerró explícitamente el modal
    clearOpenDepositId();

    // Si el usuario cierra SIN confirmar ni rechazar y todavía tiene el candado
    // (validado_por === el mismo usuario, estado sigue "procesado"), lo
    // liberamos para que otro pueda tomarlo y el depósito vuelva a "Pendiente".
    // Ya no se fuerza a que permanezca en "En Validación" al cerrar el modal.
    const depositBeingClosed = selectedDepositRef.current;
    if (depositBeingClosed && onUnlockDeposit) {
      void onUnlockDeposit(depositBeingClosed);
    }

    // Si además estaba en la cola del panel lateral, se saca de ahí también
    // -- si no, quedaba como un item fantasma que ya no tiene el candado que
    // lo protegía (otro usuario podría tomarlo mientras sigue "en cola" acá).
    if (depositBeingClosed && depositQueue.queuedIds.has(depositBeingClosed.id)) {
      depositQueue.removeFromQueue(depositBeingClosed.id);
    }

    setSelectedDeposit(null);
  }, [onUnlockDeposit, depositQueue]);


  return (
    <>
      <div className="min-h-full p-6 flex flex-col bg-gray-50 dark:bg-gray-950 lg:h-full">
        <KanbanToolbar
          isCompactKanban={isCompactKanban}
          showConnectionStatus={showConnectionStatus}
          connectionStatus={connectionStatus}
          attendedUsersSummary={attendedUsersSummary}
          selectedValidatorFilter={selectedValidatorFilter}
          handleValidatorFilterToggle={handleValidatorFilterToggle}
          clearValidatorFilter={clearValidatorFilter}
          setShowContactosModal={setShowContactosModal}
          specificDate={specificDate}
          setSpecificDate={setSpecificDate}
          onSelectDate={onSelectDate}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterDateOption={filterDateOption}
          setFilterDateOption={setFilterDateOption}
          amountSearch={amountSearch}
          setAmountSearch={setAmountSearch}
          branchPersonSearch={branchPersonSearch}
          setBranchPersonSearch={setBranchPersonSearch}
          onFetchDepositsByDate={onFetchDepositsByDate}
        />

        {depositQueue.attendedQueueIds.length > 0 && (
          <button
            type="button"
            onClick={handleOpenNextQueued}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-left transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              <ListChecks size={16} />
              <span>
                {depositQueue.attendedQueueIds.length} depósito(s) marcado(s) como atendido(s) en la cola, listos para confirmar
              </span>
            </div>
            <span className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
              Confirmar siguiente
              <ChevronRight size={16} />
            </span>
          </button>
        )}

        <KanbanColumns
          columns={KANBAN_COLUMN_DEFS}
          groupedDeposits={groupedDeposits}
          validacionSeparated={validacionSeparated}
          pendientesSeparated={pendientesSeparated}
          showNormales={showNormales}
          setShowNormales={setShowNormales}
          showAntiguos={showAntiguos}
          setShowAntiguos={setShowAntiguos}
          showPendientesEspeciales={showPendientesEspeciales}
          setShowPendientesEspeciales={setShowPendientesEspeciales}
          showPendientesOtros={showPendientesOtros}
          setShowPendientesOtros={setShowPendientesOtros}
          handleCardClick={handleCardClick}
          selectedDepositId={selectedDeposit?.id}
          realtimeActivity={realtimeActivity}
          onAddToQueue={depositQueue.addToQueue}
          queuedIds={depositQueue.queuedIds}
          attendedIds={depositQueue.attendedIds}
        />
      </div>
      <AnimatePresence>
        {selectedDeposit && (
          <DepositDetailModal
            deposit={selectedDeposit}
            onClose={handleCloseModal}
            onUpdateDeposit={handleUpdateDepositFromModal}
            empresas={empresas}
            bancos={bancos}
            cuentas={cuentas}
            sucursales={sucursales}
            personal={personal}
            allDeposits={deposits}
            onOpenVoucherWindow={onOpenVoucherWindow}
            presentationMode={detailPresentationMode}
          />
        )}
        {showContactosModal && (
          <ContactosModal onClose={() => setShowContactosModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default KanbanPage;
