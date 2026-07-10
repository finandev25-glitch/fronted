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
          updatedDeposit.estado !== selectedDeposit.estado ||
          updatedDeposit.monto !== selectedDeposit.monto;

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
      const validatorName = String(
        deposit?.validado_por_usuario?.nombre ||
          deposit?.validado_por_nombre ||
          deposit?.validado_por ||
          "",
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
      // procesado/rechazado/confirmado — "en_validacion" no existe ahí. Lo
      // que existe es "procesado" + "validado_por" seteado (alguien lo tomo
      // con el lock). Por eso agrupamos visualmente los "procesado" ya
      // tomados bajo la columna "en_validacion", y los libres se quedan en
      // "procesado" (columna "Pendiente").
      const bucket =
        deposit.estado === "procesado" && deposit.validado_por
          ? "en_validacion"
          : deposit.estado;

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
      normales: enValidacion.filter((d) => !d.es_antiguo),
      antiguos: enValidacion.filter((d) => d.es_antiguo),
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
      setSelectedDeposit(deposit);

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
          setSelectedDeposit((prev) =>
            prev && prev.id === deposit.id ? { ...prev, ...fullDeposit } : prev
          );
        })
        .catch((error) => {
          console.warn("⚠️ KANBAN: No se pudo obtener el detalle completo del deposito:", error);
        });

      console.log("🎬 KANBAN: Fin de handleCardClick");
    },
    [currentUser, onTakeDeposit],
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

    console.log(
      "🚪 KANBAN: Cerrando modal - el depósito mantiene su estado actual",
    );

    // Limpiar localStorage ya que el usuario cerró explícitamente el modal
    clearOpenDepositId();

    // NO regresar a pendiente - el depósito se queda en su estado actual
    // Esto permite que los depósitos "en_validacion" permanezcan ahí aunque se cierre el modal

    // Si el usuario cierra SIN confirmar/rechazar y todavía tiene el candado
    // (validado_por === el mismo usuario, estado sigue "procesado"), lo
    // liberamos para que otro pueda tomarlo. handleTakeDepositForValidation ya
    // hizo lo mismo internamente si confirmó/rechazó (el estado ya no sería
    // "procesado" en ese caso, asi que este unlock es un no-op ahí).
    const depositBeingClosed = selectedDepositRef.current;
    if (depositBeingClosed && onUnlockDeposit) {
      void onUnlockDeposit(depositBeingClosed);
    }

    setSelectedDeposit(null);
  }, [onUnlockDeposit]);


  return (
    <>
      <div className="h-full p-6 flex flex-col bg-gray-50 dark:bg-gray-950">
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
        />
      </div>
      <AnimatePresence>
        {selectedDeposit && (
          <DepositDetailModal
            deposit={selectedDeposit}
            onClose={handleCloseModal}
            onUpdateDeposit={onUpdateDeposit}
            empresas={empresas}
            bancos={bancos}
            cuentas={cuentas}
            sucursales={sucursales}
            personal={personal}
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
