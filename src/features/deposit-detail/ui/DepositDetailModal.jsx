import { useDepositForm } from "../hooks/useDepositForm.js";
import { useDepositActions } from "../hooks/useDepositActions.js";
import { useDepositSql } from "../hooks/useDepositSql.js";
import { DepositVoucherPanel } from "./DepositVoucherPanel.jsx";
import { DepositFormPanel } from "./DepositFormPanel.jsx";
import { searchActiveTab } from "../lib/activeTabSearch.js";
import {
  fetchCuentas,
  markDepositForRegularize,
  unmarkDepositForRegularize,
  financeRegularizeImage,
} from "../../deposits/api/depositsApi.js";
import RegularizeImageModal from "../../deposits/components/RegularizeImageModal.jsx";
import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../../auth/context/AuthContext.jsx";
import { apiGet, apiPost, apiPut } from "../../../services/backendApi.js";
import {
  X, User, Building2, CreditCard, Calendar, Clock, DollarSign,
  CheckCircle, XCircle, AlertCircle, FileText, Hash, Building, Info,
  Search, Loader2, Ban, MessageSquare, PanelRightOpen, Save, Fingerprint,
  Eye, AlertTriangle, Phone, FileDown, ExternalLink, UploadCloud,
} from "lucide-react";
import RejectionModal from "../../../components/RejectionModal";
import GoogleDrivePicker from "../../../components/GoogleDrivePicker.jsx";
import {
  ContactDetailsPortal,
  DuplicateDepositsPortal,
  FloatingVoucherPortal,
  NoDuplicatePortal,
} from "./DepositDetailOverlays.jsx";
import {
  formatCompactMoney,
  formatDepositDateTime,
} from "../lib/depositDetailFormatters.js";
import {
  CompactFieldCard,
  FALLBACK_VOUCHER_PREVIEW,
  FormRow,
  SQL_CORTADO_COLUMNS,
  SQL_MOVEMENTS_COLUMNS,
  formatSqlDateDDMMYYYY,
  formatSqlMovementDate,
  getReplyMessageIdFromDeposit,
  getSqlMovementSelectionLabel,
  getSqlPeriodRangeFromYYYYMM,
  getSqlServerCompanyConfigFromEmpresaId,
  getSqlServerDefaultRange,
  getStatusInfo,
  getYYYYMMFromDate,
  hasSqlMovementAttentionData,
  normalizeDateForInput,
  normalizeDepositCurrency,
  normalizeSqlServerRow,
  renderSqlCell,
} from "../../deposits/components/depositDetailModalHelpers.jsx";

/**
 * DepositDetailModal — Refactorizado
 *
 * BUGS CORREGIDOS:
 * - empresa_id / banco_id: usa fallback deposit.empresa_id (campo plano) cuando
 *   el backend/WebSocket no incluye el objeto empresa anidado completo.
 * - lastInitializedDepositId (useRef): evita que el WebSocket sobreescriba
 *   lo que el usuario ya seleccionó manualmente en Empresa, Banco o Anexo.
 * - Anexos: cargados desde el backend (fetchCuentas) en lugar del prop vacío.
 * - Select de Anexo: ya no está disabled por lista vacía.
 *
 * TODO (refactor incremental — hooks ya creados en hooks/):
 *   useDepositForm.js   → estado del formulario
 *   useDepositActions.js → confirmar / rechazar
 *   useDepositSql.js    → SQL movements / cortado
 */
const DepositDetailModal = ({
  deposit,
  onClose,
  onUpdateDeposit,
  empresas,
  bancos,
  cuentas,
  allDeposits = [],
  onOpenVoucherWindow,
  editMode = "full",
  presentationMode = "default",
}) => {
  if (!deposit) return null;
  const isCompactPresentation = presentationMode === "compact";
  const shouldUseDuplicateModals = isCompactPresentation;
  const { currentUser, users } = useContext(AuthContext);
  const isBackendConnected = !!currentUser;

  // 1. Hook de Formulario
  const {
    editableData,
    setEditableData,
    filteredAnexos,
    selectedMoneda,
    selectedBanco,
    activeEmpresas,
    activeBancos,
    voucherUrl: displayVoucherUrl,
    handleChange,
    handleFileSelect,
    handleFileSelectFromPicker,
    isDetailLoaded
  } = useDepositForm({ deposit, empresas, bancos });

  // 2. Hook de Acciones
  const {
    isChecking,
    isProcessing,
    isSending,
    checkResult,
    duplicateDeposits,
    isRejectionModalOpen,
    setIsRejectionModalOpen,
    canConfirm,
    canCheckDuplicates,
    handleCheckDuplicates,
    handleConfirmDeposit,
    handleConfirmRejection,
    handleRestoreToPending,
    handleSaveChanges,
    handleToggleEsAntiguo,
  } = useDepositActions({
    deposit,
    editableData,
    selectedMoneda,
    currentUser,
    empresas,
    bancos,
    allDeposits,
    onUpdateDeposit,
    onClose
  });

  // 3. Hook de SQL
  const {
    isSqlMovementsModalOpen,
    setIsSqlMovementsModalOpen,
    sqlMovementsLoading,
    sqlMovementsError,
    sqlMovementsActionMessage,
    setSqlMovementsActionMessage,
    sqlMovementsRows,
    sqlMovementsMeta,
    sqlCortadoLoading,
    sqlCortadoError,
    sqlCortadoRows,
    sqlCortadoMeta,
    sqlMovementsSearch,
    setSqlMovementsSearch,
    sqlCortadoPeriod,
    setSqlCortadoPeriod,
    sqlCortadoNroOperacionFilter,
    setSqlCortadoNroOperacionFilter,
    sqlCortadoBancoFilter,
    setSqlCortadoBancoFilter,
    sqlCortadoFechaFilter,
    setSqlCortadoFechaFilter,
    sqlCortadoImporteFilter,
    setSqlCortadoImporteFilter,
    sqlCortadoPage,
    setSqlCortadoPage,
    sqlCortadoPageSize,
    sqlCortadoTotalCount,
    setSqlCortadoTotalCount,
    sqlActiveTab,
    setSqlActiveTab,
    sqlSelectedMovement,
    sqlSelectedMovementId,
    sqlSelectionToast,
    isSqlLoading,
    closeSqlMovementsModal,
    loadSqlMovements,
    loadSqlCortado,
    exportSqlMovementsToExcel,
    handleSelectSqlMovement,
    handleSelectSqlCortado,
    persistSelectedSqlTipoIfNeeded,
    executeSqlMovementSelection,
    fetchSqlServerRows,
  } = useDepositSql({
    empresaId: editableData.empresa_id,
    empresas,
    deposit,
    onUpdateDeposit,
    editableData,
    selectedMoneda
  });

  // Utilidades que usaba el modal
  const openSqlMovementsModal = () => {
    setIsSqlMovementsModalOpen(true);
  };
  
  const [isNoDuplicateModalOpen, setIsNoDuplicateModalOpen] = useState(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [duplicateModalMode, setDuplicateModalMode] = useState("none");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [duplicateStoreDataSnapshot, setDuplicateStoreDataSnapshot] = useState("");
  // Estado del selector de Google Drive (se referenciaba en la vista compacta
  // sin estar definido, lo que rompía el modal en móvil).
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Regularizar voucher (solo finanzas/admin, independiente del Estado): el
  // mismo flujo que ya existe en el listado de tabla (TablePage), pero
  // disponible aca tambien porque el Kanban abre el detalle SIEMPRE a traves
  // de este modal (no tiene un listado propio donde marcar la fila).
  const userRolForRegularize = currentUser?.user_rol || currentUser?.rol || "";
  const canRegularize = userRolForRegularize === "finanzas" || userRolForRegularize === "admin";
  const [isMarkingRegularize, setIsMarkingRegularize] = useState(false);
  const [showRegularizeUpload, setShowRegularizeUpload] = useState(false);

  const handleMarkRegularize = async () => {
    if (!canRegularize || isMarkingRegularize) return;
    if (!window.confirm("¿Marcar este depósito para regularizar el voucher?")) return;

    setIsMarkingRegularize(true);
    try {
      await markDepositForRegularize(deposit.id);
      onUpdateDeposit({ ...deposit, pendiente_regularizar: true }, { skipPersist: true });
    } catch (error) {
      alert(`No se pudo marcar el depósito: ${error.message}`);
    } finally {
      setIsMarkingRegularize(false);
    }
  };

  const handleUnmarkRegularize = async () => {
    if (!canRegularize || isMarkingRegularize) return;
    if (!window.confirm("¿Quitar la marca de regularizar de este depósito?")) return;

    setIsMarkingRegularize(true);
    try {
      await unmarkDepositForRegularize(deposit.id);
      onUpdateDeposit({ ...deposit, pendiente_regularizar: false }, { skipPersist: true });
    } catch (error) {
      alert(`No se pudo desmarcar el depósito: ${error.message}`);
    } finally {
      setIsMarkingRegularize(false);
    }
  };

  // Sube el archivo nuevo via PUT /finance-regularize-image. No cambia
  // Estado ni encola nada al python-worker -- solo reemplaza el archivo. La
  // URL del voucher (endpoint redirect estable) no necesita actualizarse.
  const handleSubmitRegularizeImage = async (imagenBase64) => {
    await financeRegularizeImage(deposit.id, imagenBase64);
    onUpdateDeposit({ ...deposit, pendiente_regularizar: false }, { skipPersist: true });
    setShowRegularizeUpload(false);
  };

  const openDuplicateModal = (mode) => {
    setDuplicateModalMode(mode);
    setIsDuplicatesModalOpen(true);
  };

  const closeDuplicateModal = () => {
    setIsDuplicatesModalOpen(false);
    setDuplicateModalMode("none");
  };

  // Status computation
  const statusInfo = getStatusInfo(deposit.estado);
  const statusColor = statusInfo.color;
  const statusLabel = statusInfo.label;
  const StatusIcon = statusInfo.Icon;
  
  // Candado de validacion: el backend marca "validado_por" cuando alguien
  // toma el deposito (POST /lock) y lo revisa antes de aceptar confirm/reject
  // de otro usuario. Si el que tiene el candado no somos nosotros, el
  // formulario entero debe quedar en solo-lectura para no pisar su trabajo.
  const isLockedByOther = Boolean(
    deposit.validado_por &&
      currentUser &&
      String(deposit.validado_por).toLowerCase() !== String(currentUser.id).toLowerCase()
  );
  const lockedByUser = isLockedByOther
    ? users?.find((u) => String(u.id).toLowerCase() === String(deposit.validado_por).toLowerCase())
    : null;

  // FIX: el backend (Deposito.cs) solo usa los estados reales
  // "recibido" | "procesado" | "rechazado" | "confirmado" — el estado
  // "pendiente" que se comparaba aquí NUNCA existe en los datos reales,
  // así que esta condición quedaba SIEMPRE deshabilitada para todo depósito
  // que no estuviera "rechazado" (incluyendo "procesado", que es justo el
  // estado que el Kanban muestra en su columna "Pendiente"). Por eso los
  // selects de Empresa/Banco/Anexo quedaban bloqueados sin poder abrirse:
  // no era un problema de datos ni de carga, era que el formulario entero
  // estaba disabled. Ahora solo se bloquea en el estado terminal "confirmado"
  // o cuando otro usuario tiene el candado de validación.
  const isFullEditDisabled = editMode === "readonly" || deposit.estado === "confirmado" || isLockedByOther;
  const isFieldsOnlyEdit = editMode === "fields-only";

  const canShowConfirmActions = editMode !== "fields-only" && !isLockedByOther &&
    (deposit.estado === "recibido" || deposit.estado === "procesado" || deposit.estado === "rechazado");

  const [isFloatingIframeOpen, setIsFloatingIframeOpen] = useState(false);
  const [rejectedObservationText, setRejectedObservationText] = useState("");
  
  const [elapsedTime, setElapsedTime] = useState("");
  const [receivedTime, setReceivedTime] = useState("");
  const [receivedDate, setReceivedDate] = useState("");

  useEffect(() => {
    if (!deposit.fecha_registro) return;

    // Calcular hora de recibido (solo una vez)
    const registeredAt = new Date(deposit.fecha_registro);
    setReceivedTime(
      registeredAt.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
    setReceivedDate(
      registeredAt.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    );

    // Función para calcular tiempo transcurrido
    const calculateElapsed = () => {
      const now = new Date();
      const diffMs = now - registeredAt;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);

      setElapsedTime(`${diffMins}:${diffSecs.toString().padStart(2, "0")}`);
    };

    // Calcular inmediatamente
    calculateElapsed();

    // Actualizar cada segundo
    const timer = setInterval(calculateElapsed, 1000);

    return () => clearInterval(timer);
  }, [deposit.fecha_registro]);
  
  useEffect(() => {
    if (deposit.estado === "rechazado") {
      try {
        const obs = deposit.observaciones ? JSON.parse(deposit.observaciones) : [];
        const rejectedObs = obs.find((o) => o.tipo === "rechazo");
        setRejectedObservationText(rejectedObs ? rejectedObs.texto : deposit.observaciones || "");
      } catch (e) {
        setRejectedObservationText(deposit.observaciones || "");
      }
    }
  }, [deposit.estado, deposit.observaciones]);
  
  const rejectedObservationSummary = rejectedObservationText.length > 100 
    ? rejectedObservationText.substring(0, 100) + "..." 
    : rejectedObservationText;

  // Variables no migradass del panel de solicitante
  const [editingSolicitante, setEditingSolicitante] = useState(false);
  const [searchTrabajador, setSearchTrabajador] = useState("");
  const [buscandoTrabajador, setBuscandoTrabajador] = useState(false);
  const [trabajadoresEncontrados, setTrabajadoresEncontrados] = useState([]);
  const [solicitanteData, setSolicitanteData] = useState({
    trabajador_id: "",
    trabajador_nombre: "",
    telefono_origen: "",
    sucursal_id: "",
    sucursal_nombre: "",
  });

  const seleccionarTrabajador = (trabajador) => {
    setSolicitanteData({
      trabajador_id: trabajador.id,
      trabajador_nombre: trabajador.nombre,
      telefono_origen: trabajador.telefono_origen || "",
      sucursal_id: trabajador.sucursal?.id || "",
      sucursal_nombre: trabajador.sucursal?.nombre || "",
    });
    setTrabajadoresEncontrados([]);
    setSearchTrabajador(trabajador.nombre);
  };

  const cancelarEdicionSolicitante = () => {
    setEditingSolicitante(false);
    setSearchTrabajador("");
    setTrabajadoresEncontrados([]);
    setSolicitanteData({
      trabajador_id: "",
      trabajador_nombre: "",
      telefono_origen: "",
      sucursal_id: "",
      sucursal_nombre: "",
    });
  };

  const guardarCambiosSolicitante = async () => {
    // Logica reducida por ahora
    setEditingSolicitante(false);
  };

  const [isCompactSearching, setIsCompactSearching] = useState(false);
  const [compactVoucherUrl, setCompactVoucherUrl] = useState("");
  const canUseChromeSearch = true; // simplificado

  // Fallback PDF: si el <img> falla al cargar (p.ej. la URL /image es en realidad
  // un PDF, sin extensión que lo delate), pasamos a mostrarlo en iframe.
  const [voucherImgFailed, setVoucherImgFailed] = useState(false);
  useEffect(() => {
    setVoucherImgFailed(false);
  }, [displayVoucherUrl, compactVoucherUrl]);

  // FIX: la vista compacta/móvil usa compactVoucherUrl, pero nunca se poblaba
  // (setCompactVoucherUrl no se llamaba en ningún lado), así que el voucher no
  // se veía en móvil. Lo sincronizamos con la URL real del voucher del hook.
  useEffect(() => {
    setCompactVoucherUrl(displayVoucherUrl || "");
  }, [displayVoucherUrl]);

  const [compactSearchTone, setCompactSearchTone] = useState("neutral");
  const [compactSearchStatus, setCompactSearchStatus] = useState("Sin verificar.");

  useEffect(() => {
    setCompactSearchTone("neutral");
    setCompactSearchStatus("Sin verificar.");
  }, [deposit?.id]);

  // Busca el importe o el nro. de operación en la PESTAÑA ACTIVA (el portal del
  // banco abierto en otra pestaña) y resalta la coincidencia. Solo funciona en
  // la extensión (usa chrome.scripting). Da feedback visible en cada paso.
  const runCompactSearch = async (type) => {
    console.log("[busqueda] runCompactSearch:", type);
    const terms = [];
    const add = (value) => {
      const text = String(value ?? "").trim();
      if (text && !terms.includes(text)) terms.push(text);
    };

    if (type === "amount") {
      const raw = editableData.monto || deposit.monto;
      if (raw !== undefined && raw !== null && raw !== "") {
        add(raw);
        const n = Number(String(raw).replace(/[^0-9,.-]/g, "").replace(",", "."));
        if (!Number.isNaN(n)) {
          add(n.toFixed(2));
          add(n.toLocaleString("es-PE"));
          add(n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          add(n.toLocaleString("en-US"));
          add(n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      }
    } else {
      const op = editableData.numero_operacion_banco || deposit.numero_operacion_banco;
      [op, deposit.numero_operacion].forEach((value) => {
        add(value);
        const digits = String(value || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        if (digits) add(digits);
      });
    }

    console.log("[busqueda] términos:", terms);

    if (terms.length === 0) {
      setCompactSearchTone("error");
      setCompactSearchStatus("No hay importe / nro. operación para buscar.");
      return;
    }

    setIsCompactSearching(true);
    setCompactSearchStatus("Buscando en la pestaña activa...");
    try {
      const res = await searchActiveTab(terms);
      console.log("[busqueda] resultado:", res);
      if (res.available === false) {
        setCompactSearchTone("error");
        setCompactSearchStatus("Solo disponible dentro de la extensión.");
      } else if (res.found) {
        setCompactSearchTone("success");
        setCompactSearchStatus(
          `Encontrado y resaltado${res.matches ? ` (${res.matches})` : ""}.`,
        );
      } else {
        setCompactSearchTone("error");
        setCompactSearchStatus("No se encontró en la pestaña activa.");
      }
    } catch (error) {
      setCompactSearchTone("error");
      setCompactSearchStatus(`Error: ${error?.message || "no se pudo buscar"}`);
      console.warn("[busqueda] error:", error);
    } finally {
      setIsCompactSearching(false);
    }
  };

  const compactModalBorderClass =
    deposit.estado === "rechazado"
      ? "border-red-500/70"
      : deposit.estado === "en_validacion"
        ? "border-blue-500/70"
        : deposit.estado === "validado"
          ? "border-emerald-500/70"
          : deposit.estado === "recibido"
            ? "border-orange-500/70"
            : "border-slate-200";

  const compactModalHeaderClass =
    deposit.estado === "rechazado"
      ? "border-red-200 bg-red-50/95 dark:border-red-900/40 dark:bg-red-950/35"
      : deposit.estado === "en_validacion"
        ? "border-blue-200 bg-blue-50/95 dark:border-blue-900/40 dark:bg-blue-950/35"
        : deposit.estado === "validado"
          ? "border-emerald-200 bg-emerald-50/95 dark:border-emerald-900/40 dark:bg-emerald-950/35"
          : deposit.estado === "recibido"
            ? "border-orange-200 bg-orange-50/95 dark:border-orange-900/40 dark:bg-orange-950/35"
            : "border-gray-200 bg-white/95 dark:border-gray-800 dark:bg-gray-900/95";

  const compactModalHeaderTitleClass =
    deposit.estado === "rechazado"
      ? "text-red-900 dark:text-red-100"
      : deposit.estado === "en_validacion"
        ? "text-blue-900 dark:text-blue-100"
        : deposit.estado === "validado"
          ? "text-emerald-900 dark:text-emerald-100"
          : deposit.estado === "recibido"
            ? "text-orange-900 dark:text-orange-100"
            : "text-slate-900 dark:text-slate-100";

  const compactStoreDataRows = useMemo(
    () => [
      { label: "Banco", value: selectedBanco?.abreviatura || selectedBanco?.nombre || "-" },
      { label: "Anexo", value: editableData.anexo || deposit?.anexo || "-" },
      { label: "Moneda", value: selectedMoneda || "-" },
      { label: "Nro. op. banco", value: editableData.numero_operacion_banco || deposit?.numero_operacion_banco || "-" },
      { label: "Importe", value: formatCompactMoney(editableData.monto || deposit?.monto, selectedMoneda || deposit?.moneda) },
      { label: "Fecha depósito", value: editableData.fecha_deposito || deposit?.fecha_deposito || "-" },
    ],
    [deposit, editableData, selectedBanco, selectedMoneda],
  );

  const compactStoreDataText = useMemo(
    () =>
      compactStoreDataRows.map((row) => `${row.label}: ${row.value}`).join("\n"),
    [compactStoreDataRows],
  );
  const compactStoreDataSnapshot = duplicateStoreDataSnapshot || compactStoreDataText;

  const compactContactRows = useMemo(
    () => [
      { label: "Personal", value: deposit?.trabajador?.nombre || "-" },
      { label: "Sucursal", value: deposit?.sucursal?.nombre || "-" },
      { label: "Teléfono trabajador", value: deposit?.trabajador?.telefono_origen || "-" },
      { label: "Teléfono sucursal", value: deposit?.sucursal?.telefono || "-" },
      { label: "Teléfono de contacto", value: deposit?.trabajador?.telefono_origen || deposit?.sucursal?.telefono || "-" },
    ],
    [deposit],
  );

  const compactUsesIframe =
    compactVoucherUrl &&
    (compactVoucherUrl.toLowerCase().includes(".pdf") ||
      compactVoucherUrl.toLowerCase().includes("/preview"));
  const compactSearchStatusClass =
    compactSearchTone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-200"
      : compactSearchTone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/30 dark:text-rose-200"
        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-gray-700 dark:bg-gray-950/60 dark:text-slate-300";


  const nroOperacionClasses = "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400";
  const getCardBorderColor = (type) => "border-gray-200";

  const sqlMovementsModalPortal =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {isSqlMovementsModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-4"
                onClick={closeSqlMovementsModal}
              >
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  className="flex h-[90vh] w-[98vw] max-w-[98vw] min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {sqlMovementsMeta?.empresaNombre ||
                          getSqlServerCompanyConfigFromEmpresaId(
                            editableData.empresa_id,
                            empresas,
                          ).empresaNombre}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Consulta SQL Server.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeSqlMovementsModal}
                      className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      title="Cerrar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex flex-1 gap-4 overflow-hidden p-4">
                    <div className="flex h-full min-h-[34rem] w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-gray-700 dark:bg-gray-800/70 dark:text-slate-400">
                        Voucher
                      </div>
                      <div className="min-h-0 flex-1 p-3">
                        <div className="flex h-full min-h-0 items-stretch">
                          {displayVoucherUrl ? (
                            displayVoucherUrl.includes(".pdf") || displayVoucherUrl.includes("/preview") || voucherImgFailed ? (
                              <iframe src={displayVoucherUrl} title="Voucher PDF" className="h-full w-full rounded-xl border border-slate-200 bg-white dark:border-gray-700" />
                            ) : (
                              <img src={displayVoucherUrl} alt={"Voucher " + (deposit.numero_voucher || deposit.numero_operacion)} className="h-full w-full rounded-xl border border-slate-200 object-contain dark:border-gray-700" onError={() => { if (displayVoucherUrl) setVoucherImgFailed(true); }} />
                            )
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-950 dark:text-slate-400">
                              No hay voucher disponible.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900/40">
                      <div className="border-b border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSqlActiveTab("movimientos")}
                            className={"rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                              (sqlActiveTab === "movimientos"
                                ? "bg-slate-800 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")}
                          >
                            Movimientos por identificar
                          </button>
                          <button
                            type="button"
                            onClick={() => setSqlActiveTab("cortado")}
                            className={"rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                              (sqlActiveTab === "cortado"
                                ? "bg-slate-800 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")}
                          >
                            Cortado vs RegistrosConcar
                          </button>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                          {sqlActiveTab === "cortado" ? (
                            <>
                              <div className="w-[132px] flex-none">
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                  Periodo del reporte (YYYYMM)
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={sqlCortadoPeriod}
                                  onChange={(e) => setSqlCortadoPeriod(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void loadSqlCortado(1);
                                    }
                                  }}
                                  placeholder="Ej. 202606"
                                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <div className="w-[150px] flex-none">
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Nro. operación
                                  </label>
                                  <input
                                    type="text"
                                    value={sqlCortadoNroOperacionFilter}
                                    onChange={(e) => setSqlCortadoNroOperacionFilter(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void loadSqlCortado(1);
                                      }
                                    }}
                                    placeholder="Ej. 123456"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                  />
                                </div>
                                <div className="w-[150px] flex-none">
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Banco
                                  </label>
                                  <input
                                    type="text"
                                    value={sqlCortadoBancoFilter}
                                    onChange={(e) => setSqlCortadoBancoFilter(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void loadSqlCortado(1);
                                      }
                                    }}
                                    placeholder="Ej. BCP"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                  />
                                </div>
                                <div className="w-[150px] flex-none">
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Fecha
                                  </label>
                                  <input
                                    type="date"
                                    value={sqlCortadoFechaFilter}
                                    onChange={(e) => setSqlCortadoFechaFilter(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void loadSqlCortado(1);
                                      }
                                    }}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                  />
                                </div>
                                <div className="w-[150px] flex-none">
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Importe
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={sqlCortadoImporteFilter}
                                    onChange={(e) => setSqlCortadoImporteFilter(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void loadSqlCortado(1);
                                      }
                                    }}
                                    placeholder="Ej. 1500.00"
                                    step="0.01"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="w-[50ch] max-w-full flex-none">
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                Buscar en movimientos
                              </label>
                              <input
                                type="text"
                                inputMode="text"
                                value={sqlMovementsSearch}
                                onChange={(e) => setSqlMovementsSearch(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void loadSqlMovements(sqlMovementsSearch);
                                  }
                                }}
                                placeholder="Nro. operacion, banco, sucursal, contacto, RUC, observacion..."
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (sqlActiveTab === "cortado") {
                                  void loadSqlCortado(1);
                                } else {
                                  void loadSqlMovements(sqlMovementsSearch);
                                }
                              }}
                              disabled={sqlMovementsLoading || sqlCortadoLoading}
                              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {sqlMovementsLoading || sqlCortadoLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                              {sqlActiveTab === "cortado" ? "Consultar BD" : "Buscar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSqlMovementsSearch("");
                                setSqlCortadoPeriod("");
                                setSqlCortadoNroOperacionFilter("");
                                setSqlCortadoBancoFilter("");
                                setSqlCortadoFechaFilter("");
                                setSqlCortadoImporteFilter("");
                                setSqlCortadoPage(1);
                                setSqlCortadoTotalCount(0);
                                void loadSqlMovements("");
                              }}
                              disabled={sqlMovementsLoading || sqlCortadoLoading}
                              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              Limpiar
                            </button>
                          </div>
                        </div>

                        {sqlActiveTab === "movimientos" ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-slate-200 px-2 py-1 dark:bg-slate-700">
                              Desde: {sqlMovementsMeta?.fechaInicio || getSqlServerDefaultRange().fechaInicio}
                            </span>
                            <span className="rounded-full bg-slate-200 px-2 py-1 dark:bg-slate-700">
                              Hasta: {sqlMovementsMeta?.fechaFin || getSqlServerDefaultRange().fechaFin}
                            </span>
                          </div>
                        ) : null}

                        {sqlMovementsActionMessage ? (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                            {sqlMovementsActionMessage}
                          </div>
                        ) : null}
                        {sqlMovementsError ? (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200">
                            {sqlMovementsError}
                          </div>
                        ) : null}
                        {sqlCortadoError ? (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200">
                            {sqlCortadoError}
                          </div>
                        ) : null}
                        {sqlActiveTab === "cortado" && sqlCortadoPeriod && !/^\d{6}$/.test(sqlCortadoPeriod) ? (
                          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                            El periodo debe tener formato YYYYMM, por ejemplo 202606.
                          </div>
                        ) : null}
                      </div>

                      <div className="min-h-0 flex-1 overflow-hidden">
                        {sqlActiveTab === "movimientos" ? (
                          sqlMovementsLoading && sqlMovementsRows.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                              <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-sm">Consultando SQL Server...</span>
                              </div>
                            </div>
                          ) : sqlMovementsRows.length === 0 ? (
                            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                              No hay movimientos para mostrar con los filtros actuales.
                            </div>
                          ) : (
                            <div className="h-full overflow-x-auto overflow-y-auto">
                              <table className="w-max min-w-max table-auto border-separate border-spacing-0 whitespace-nowrap">
                                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-gray-800">
                                  <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Fecha</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700 w-[15ch] max-w-[15ch]">Banco</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Nro. op.</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Descripcion</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700 text-right">Abono</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700 text-right">Reg</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Sucursal</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Contacto</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Validado por</th>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Observación</th>
                                    <th className="sticky right-0 z-20 border-b border-l border-slate-200 bg-slate-100 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">Accion</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                                  {sqlMovementsRows.map((row, index) => (
                                    <tr
                                      key={String(row.CUO || row.ID || index)}
                                      className={"align-top text-sm transition-colors border-b-2 border-slate-300 dark:border-gray-600 " +
                                        (String(row.REGISTRO || "").trim()
                                          ? "bg-emerald-100/80 text-emerald-950 hover:bg-emerald-200/80 dark:bg-emerald-900/35 dark:text-emerald-50 dark:hover:bg-emerald-800/45"
                                          : hasSqlMovementAttentionData(row)
                                            ? "bg-orange-300/95 text-orange-950 hover:bg-orange-400/95 dark:bg-orange-900/55 dark:text-orange-50 dark:hover:bg-orange-800/60"
                                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800/60")}
                                    >
                                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{formatSqlMovementDate(row.FECHA)}</td>
                                      <td className="w-[15ch] max-w-[15ch] overflow-hidden whitespace-nowrap px-4 py-3 text-ellipsis" title={row.BANCO || "-"}>{row.BANCO || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.NRO_OPER || row.CUO || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-xs">{row.DESCRIPCION || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCompactMoney(row.ABONO, "PEN")}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCompactMoney(row.REG, "PEN")}</td>
                                      <td className="whitespace-nowrap px-4 py-3">{row.Sucursal || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3">
                                        <div className="space-y-0.5">
                                          <div>{row.Contacto || "-"}</div>
                                          <div className="text-xs text-current/75">{row.TelefonoContacto || ""}</div>
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3">{row.ValidadoPor || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3">{row.Observacion || row.OBSERVACION || "-"}</td>
                                      <td className="sticky right-0 z-10 whitespace-nowrap border-l border-slate-200 bg-inherit px-4 py-3 dark:border-gray-700 dark:bg-inherit">
                                        <button type="button" onClick={() => void executeSqlMovementSelection(row)} className="inline-flex items-center rounded-lg border border-amber-400 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600">Seleccionar</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        ) : (
                          <div className="flex h-full flex-col">
                            {sqlCortadoLoading && sqlCortadoRows.length === 0 ? (
                              <div className="flex h-full items-center justify-center">
                                <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                                  <Loader2 className="h-8 w-8 animate-spin" />
                                  <span className="text-sm">Consultando SQL Server...</span>
                                </div>
                              </div>
                            ) : sqlCortadoRows.length === 0 ? (
                              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                No hay registros para mostrar con los filtros actuales.
                              </div>
                            ) : (
                              <div className="h-full overflow-x-auto overflow-y-auto">
                                <table className="w-max min-w-max table-auto border-separate border-spacing-0 whitespace-nowrap">
                                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-gray-800">
                                    <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Fecha</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Banco</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Nro. op.</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Descripcion</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700 text-right">Cargo</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700 text-right">Abono</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700 text-right">Reg</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700 text-right">Dif</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">Registro</th>
                                      <th className="border-b border-slate-200 px-4 py-3 dark:border-gray-700">GLOSA</th>
                                      <th className="sticky right-0 z-20 border-b border-l border-slate-200 bg-slate-100 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                                        Accion
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                                    {sqlCortadoRows.map((row, index) => (
                                      <tr
                                        key={String(row.CUO || row.ID || index)}
                                        className={"align-top text-sm transition-colors border-b-2 border-slate-300 dark:border-gray-600 " +
                                          (String(row.REGISTRO || "").trim()
                                            ? "bg-emerald-100/80 text-emerald-950 hover:bg-emerald-200/80 dark:bg-emerald-900/35 dark:text-emerald-50 dark:hover:bg-emerald-800/45"
                                            : Number(row.DIF || 0) !== 0
                                              ? "bg-amber-200/90 text-amber-950 hover:bg-amber-300/90 dark:bg-amber-900/40 dark:text-amber-50 dark:hover:bg-amber-800/50"
                                              : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800/60")}
                                      >
                                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{formatSqlMovementDate(row.FECHA)}</td>
                                      <td className="whitespace-nowrap px-4 py-3">{row.BANCO || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.NRO_OPER || row.CUO || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-xs">{row.DESCRIPCION || "-"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCompactMoney(row.CARGO, "PEN")}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCompactMoney(row.ABONO, "PEN")}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCompactMoney(row.REG, "PEN")}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono">{formatCompactMoney(row.DIF, "PEN")}</td>
                                        <td className="whitespace-nowrap px-4 py-3">{row.REGISTRO || "-"}</td>
                                        <td className="whitespace-nowrap px-4 py-3">{row.GLOSA || "-"}</td>
                                        <td className="sticky right-0 z-10 whitespace-nowrap border-l border-slate-200 bg-inherit px-4 py-3 dark:border-gray-700 dark:bg-inherit">
                                          <button
                                            type="button"
                                            onClick={() => void handleSelectSqlCortado(row)}
                                            className="inline-flex items-center rounded-lg border border-amber-400 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
                                          >
                                            Seleccionar
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-slate-300">
                              <div>
                                {sqlCortadoTotalCount
                                  ? "Mostrando " + Math.min((sqlCortadoPage - 1) * sqlCortadoPageSize + 1, sqlCortadoTotalCount) + "-" + Math.min(sqlCortadoPage * sqlCortadoPageSize, sqlCortadoTotalCount) + " de " + sqlCortadoTotalCount
                                  : "Sin resultados"}
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => void loadSqlCortado(Math.max(1, sqlCortadoPage - 1))} disabled={sqlCortadoLoading || sqlCortadoPage <= 1} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">Anterior</button>
                                <span className="min-w-[7rem] text-center font-semibold">P?gina {sqlCortadoPage} / {Math.max(1, Math.ceil((sqlCortadoTotalCount || 0) / sqlCortadoPageSize))}</span>
                                <button type="button" onClick={() => void loadSqlCortado(sqlCortadoPage + 1)} disabled={sqlCortadoLoading || sqlCortadoPage >= Math.max(1, Math.ceil((sqlCortadoTotalCount || 0) / sqlCortadoPageSize))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">Siguiente</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-slate-300">
                    <div>
                      {sqlMovementsMeta?.count != null
                        ? sqlMovementsMeta.count + " movimiento(s) cargado(s)"
                        : "Consulta SQL Server"}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={exportSqlMovementsToExcel} disabled={!sqlMovementsRows.length} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                        <Save className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button type="button" onClick={closeSqlMovementsModal} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                        Cerrar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  if (isCompactPresentation) {
    return (
      <>
        {sqlMovementsModalPortal}
        <AnimatePresence>
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-0">
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`relative flex h-[96vh] w-full min-w-0 max-w-none flex-col overflow-hidden rounded-2xl border bg-[#f8fafc] shadow-2xl dark:bg-gray-950 ${compactModalBorderClass}`}
          >
            <div
              className={`flex items-center justify-between gap-2 border-b px-2 py-1.5 ${compactModalHeaderClass}`}
            >
              <div className="min-w-0">
                <div
                  className={`text-xs font-semibold uppercase tracking-[0.16em] ${compactModalHeaderTitleClass}`}
                >
                  Ventana de validación
                </div>
                {deposit.estado === "rechazado" &&
                  rejectedObservationText.length > 0 && (
                    <div
                      className="mt-1 flex max-w-full items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[9px] font-semibold tracking-[0.02em] text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                      title={rejectedObservationSummary}
                    >
                      <div className="shrink-0 uppercase tracking-[0.12em] text-red-600 dark:text-red-300">
                        Obs
                      </div>
                      <div className="min-w-0 whitespace-pre-wrap break-words leading-tight">
                        {rejectedObservationSummary}
                      </div>
                    </div>
                  )}

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {deposit.riesgo && (
                    <span className="danger-blink inline-flex items-center gap-1 rounded-md border border-red-400 bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200">
                      <AlertTriangle className="h-3 w-3" />
                      Riesgo · Revisar
                    </span>
                  )}
                  {deposit.pendiente_regularizar && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-yellow-400 bg-yellow-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200">
                      <FileText className="h-3 w-3" />
                      Pendiente regularizar
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center space-x-2 rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusColor}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  <span>{statusLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Contacto
                </button>
                {deposit.estado === "rechazado" && (
                  <button
                    type="button"
                    onClick={handleRestoreToPending}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                    title="Restaurar depósito a pendiente"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Pendiente
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  title="Cerrar ventana"
                  aria-label="Cerrar ventana"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden px-2 py-2">
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
                <div className="shrink-0 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-200/70 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/85 dark:shadow-black/20">
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Empresa
                        </label>
                        <select
                          name="empresa_id"
                          value={editableData.empresa_id}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}
                          className={`w-full rounded-xl border px-2.5 py-1.5 text-sm outline-none transition-colors focus:ring-2 ${
                            !editableData.empresa_id
                              ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                              : "border-slate-300 bg-white dark:border-gray-700 dark:bg-gray-950"
                          }`}
                        >
                          <option value="">Seleccionar</option>
                          {activeEmpresas.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.AliasEmpresa || e.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Banco
                        </label>
                        <select
                          name="banco_id"
                          value={editableData.banco_id}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}
                          className={`w-full rounded-xl border px-2.5 py-1.5 text-sm font-mono outline-none transition-colors focus:ring-2 ${
                            !editableData.banco_id
                              ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                              : "border-slate-300 bg-white dark:border-gray-700 dark:bg-gray-950"
                          }`}
                        >
                          <option value="">Seleccionar</option>
                          {activeBancos.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.abreviatura}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Anexo
                        </label>
                        <select
                          name="anexo"
                          value={editableData.anexo}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}
                          className={`w-full rounded-xl border px-2.5 py-1.5 text-sm font-mono outline-none transition-colors focus:ring-2 ${
                            !editableData.anexo
                              ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                              : "border-slate-300 bg-white dark:border-gray-700 dark:bg-gray-950"
                          }`}
                        >
                          <option value="">{filteredAnexos.length === 0 ? "N/A" : "Seleccionar"}</option>
                          {filteredAnexos.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>

      <div className="space-y-1">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Moneda
        </label>
        <select
          name="moneda"
          value={selectedMoneda}
          onChange={handleChange}
          disabled={isFieldsOnlyEdit ? true : isFullEditDisabled}
          className={`w-full rounded-xl border px-2.5 py-1.5 text-sm outline-none transition-colors focus:ring-2 ${
            !selectedMoneda
              ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
              : "border-slate-300 bg-white dark:border-gray-700 dark:bg-gray-950"
          }`}
        >
          <option value="">Seleccionar</option>
          <option value="PEN">Soles (PEN)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          <span>Importe</span>
                          <button
                            type="button"
                            onClick={() => runCompactSearch("amount")}
                            disabled={!compactVoucherUrl || isCompactSearching}
                            className="inline-flex h-6 min-w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-[10px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-900/50 dark:bg-violet-900/30 dark:text-violet-200 dark:hover:bg-violet-900/50"
                            title="Buscar importe"
                            aria-label="Buscar importe"
                          >
                            <Search className="h-3 w-3" />
                            <span>Buscar</span>
                          </button>
                        </label>
                        <input
                          type="number"
                          name="monto"
                          value={editableData.monto}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? true : isFullEditDisabled}
                          className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono text-right outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          <span>Nro. op.</span>
                          <button
                            type="button"
                            onClick={() => runCompactSearch("operation")}
                            disabled={!compactVoucherUrl || isCompactSearching}
                            className="inline-flex h-6 min-w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
                            title="Buscar nro. operación"
                            aria-label="Buscar nro. operación"
                          >
                            <Search className="h-3 w-3" />
                            <span>Buscar</span>
                          </button>
                        </label>
                        <input
                          type="text"
                          name="numero_operacion_banco"
                          value={editableData.numero_operacion_banco}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? true : isFullEditDisabled}
                          className={`w-full rounded-xl border px-2.5 py-1.5 text-sm font-mono outline-none transition-colors focus:ring-2 ${nroOperacionClasses}`}
                          placeholder="pega la operacion"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Fecha depósito
                        </label>
                        <input
                          type="date"
                          name="fecha_deposito"
                          value={editableData.fecha_deposito}
                          onChange={handleChange}
                          disabled={isFieldsOnlyEdit ? true : isFullEditDisabled}
                          className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={handleCheckDuplicates}
                        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isProcessing || !canCheckDuplicates}
                      >
                        <AlertCircle className="h-4 w-4" />
                        Duplicados
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleEsAntiguo}
                        disabled={isProcessing}
                        className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                          deposit?.es_antiguo
                            ? "bg-slate-700 text-white hover:bg-slate-800"
                            : "bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                        {deposit?.es_antiguo ? "Antiguo ✓" : "Antiguo"}
                      </button>
                      <button
                        type="button"
                        onClick={openSqlMovementsModal}
                        disabled={isProcessing}
                        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Ver movimientos SQL por identificar"
                      >
                        <Search className="h-4 w-4" />
                        SQL
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRejectionModalOpen(true)}
                        disabled={isProcessing}
                        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" />
                        Rechazar
                      </button>
                    </div>

                    <div
                      className={`flex w-full flex-none items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[10px] ${
                        checkResult.checked
                          ? checkResult.isDuplicate
                            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/30 dark:text-rose-200"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-200"
                          : compactSearchStatusClass
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate whitespace-nowrap">
                          {checkResult.checked
                            ? checkResult.message
                            : isCompactSearching
                              ? "Buscando..."
                              : compactSearchStatus}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              <div className="flex min-h-0 flex-1 self-stretch flex-col rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-200/70 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/85 dark:shadow-black/20">
                <div className="mb-2 flex items-center justify-between gap-3 flex-none">
                  <p className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-gray-100">
                    {deposit?.cliente || "Sin cliente"}
                  </p>
                  {compactVoucherUrl && (
                    <a
                      href={compactVoucherUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir
                    </a>
                  )}
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/80">
                  {!compactVoucherUrl ? (
                    <div className="flex h-full min-h-0 items-center justify-center p-6 text-center text-sm text-slate-300">
                      No hay voucher disponible.
                    </div>
                  ) : compactUsesIframe || voucherImgFailed ? (
                    <div className="absolute inset-0">
                      <iframe
                        src={`${compactVoucherUrl}#toolbar=1&navpanes=1&scrollbar=1&view=Fit`}
                        title="Voucher lateral"
                        className="h-full w-full border-0 bg-black"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <img
                        src={compactVoucherUrl}
                        alt={`Voucher ${deposit.numero_voucher || deposit.numero_operacion}`}
                        className="max-h-full max-w-full object-contain object-center"
                        onError={() => {
                          if (compactVoucherUrl) setVoucherImgFailed(true);
                        }}
                      />
                    </div>
                  )}

                </div>

                {/* Cliente y botón abrir quedan arriba para mantener el card compacto */}
              </div>

              {isContactModalOpen && (
                <div
                  className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
                  onClick={() => setIsContactModalOpen(false)}
                >
                  <div
                    className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Datos del contacto
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Información de la persona y sucursal asociada al depósito.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsContactModalOpen(false)}
                        className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-gray-700 dark:hover:text-white"
                        title="Cerrar"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {compactContactRows.map((row) => (
                          <div
                            key={row.label}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                              {row.label}
                            </div>
                            <div className="mt-1 break-words text-sm font-mono text-slate-900 dark:text-slate-100">
                              {row.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                      <button
                        type="button"
                        onClick={() => setIsContactModalOpen(false)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {duplicateModalMode === "no_duplicate" && (
                <div
                  className="absolute inset-0 z-[210] flex items-center justify-center bg-black/70 p-4"
                  onClick={() => {
                    setDuplicateModalMode("none");
                    setIsNoDuplicateModalOpen(false);
                  }}
                >
                  <div
                    className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-500 p-2">
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                            Sin duplicados
                          </h3>
                          <p className="text-sm text-emerald-700 dark:text-emerald-200">
                            No se encontraron coincidencias. Puedes confirmar el depósito.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicateModalMode("none");
                          setIsNoDuplicateModalOpen(false);
                        }}
                        className="rounded-full p-2 text-emerald-700 transition-colors hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                        title="Cerrar"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                          Datos de la tienda
                        </div>
                        <div className="whitespace-pre-line rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 dark:border-slate-700 dark:bg-gray-950/30 dark:text-slate-100">
                          {compactStoreDataSnapshot}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                      <button
                        type="button"
                        onClick={handleConfirmDeposit}
                        disabled={!canConfirm || isSending || isProcessing}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Confirmar depósito"
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {duplicateModalMode === "duplicate" && (
                <div
                  className="absolute inset-0 z-[210] flex items-center justify-center bg-black/80 p-4"
                  onClick={() => {
                    setDuplicateModalMode("none");
                    setIsDuplicatesModalOpen(false);
                  }}
                >
                  <div
                    className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-gray-200 bg-red-50 p-4 dark:border-gray-700 dark:bg-red-900/20">
                      <div className="flex items-center space-x-3">
                        <div className="rounded-lg bg-red-500 p-2">
                          <AlertCircle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                            Depósitos Duplicados Encontrados
                          </h3>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Se encontraron {duplicateDeposits.length} depósito(s) con datos similares
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setDuplicateModalMode("none");
                          setIsDuplicatesModalOpen(false);
                        }}
                        className="rounded-full p-2 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
                        title="Cerrar"
                      >
                        <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                        <div className="text-sm font-bold text-red-900 dark:text-red-100">
                          Depósitos duplicados encontrados
                        </div>
                        <div className="mt-1 text-sm text-red-700 dark:text-red-200">
                          Se muestran los depósitos encontrados como cards individuales.
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {duplicateDeposits.map((dup, index) => {
                          const statusInfo = getStatusInfo(dup.estado);
                          const StatusIcon = statusInfo.Icon;
                          return (
                            <div
                              key={dup.id || `${dup.numero_operacion_banco || dup.numero_operacion || "dup"}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Duplicado #{index + 1}
                                  </div>
                                  <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {dup.sucursal?.nombre || "Sin sucursal"}
                                  </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusInfo.color}`}>
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  {statusInfo.label}
                                </span>
                              </div>

                              <div className="mt-4 grid gap-2 text-sm">
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Empresa
                                  </div>
                                  <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                                    {dup.empresa?.nombre || "-"}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Banco
                                  </div>
                                  <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                                    {dup.banco?.abreviatura || dup.banco?.nombre || "-"}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Nro. operación
                                  </div>
                                  <div className="mt-0.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                                    {dup.numero_operacion_banco || dup.numero_operacion || "-"}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Importe
                                  </div>
                                  <div className="mt-0.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                                    {formatCompactMoney(dup.monto, dup.moneda)}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Fecha depósito
                                  </div>
                                  <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                                    {dup.fecha_deposito || "-"}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Fecha registro
                                  </div>
                                  <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                                    {formatDepositDateTime(dup.fecha_registro)}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-800/70 md:col-span-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                    Personal
                                  </div>
                                  <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                                    {dup.trabajador?.nombre || "-"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                      <button
                        onClick={() => {
                          setDuplicateModalMode("none");
                          setIsDuplicatesModalOpen(false);
                        }}
                        className="rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </motion.div>
          {isRejectionModalOpen && (
            <RejectionModal
              onClose={() => setIsRejectionModalOpen(false)}
              onConfirm={handleConfirmRejection}
            />
          )}
          {isPickerOpen && (
            <GoogleDrivePicker
              onClose={() => setIsPickerOpen(false)}
              onFileSelect={handleFileSelectFromPicker}
            />
          )}

        </div>
        </AnimatePresence>
      </>
    );
  }


  return (
    <>
      {sqlMovementsModalPortal}
      {sqlSelectionToast ? (
        <div className="fixed left-1/2 top-4 z-[220] -translate-x-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-100">
          {sqlSelectionToast}
        </div>
      ) : null}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${
          isCompactPresentation ? "bg-black/45 p-2 md:p-3" : "bg-black/60 dark:bg-black/70 p-4"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`bg-white dark:bg-gray-800 w-full flex flex-col shadow-2xl ${
            isCompactPresentation
              ? "w-full max-w-[1400px] min-w-0 max-h-[96vh] h-[96vh] rounded-2xl"
              : "max-w-7xl max-h-[85vh] h-[85vh] md:max-h-[93vh] md:h-[93vh] rounded-xl"
          }`}
        >
          <div className="flex items-center justify-between p-2 md:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-gray-900 dark:text-gray-100">
                  Detalle del Depósito
                </h2>
                <div className="hidden sm:flex items-center gap-4 mt-1.5 text-sm md:text-base">
                  <span className="text-gray-600 dark:text-gray-400">
                    📅 Recibido:{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {receivedDate} {receivedTime}
                    </strong>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    ⏱️ Transcurrido:{" "}
                    <strong className="text-orange-600 dark:text-orange-400">
                      {elapsedTime}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {deposit.riesgo && (
                <span className="danger-blink inline-flex items-center gap-1.5 rounded-full border border-red-400 bg-red-100 px-3 py-1 text-sm font-bold uppercase tracking-wide text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  Riesgo · Revisar
                </span>
              )}
              {deposit.pendiente_regularizar && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400 bg-yellow-100 px-3 py-1 text-sm font-bold uppercase tracking-wide text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200">
                  <FileText className="h-4 w-4" />
                  Pendiente regularizar
                </span>
              )}
              <span
                className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}
              >
                <StatusIcon className="h-4 w-4" />
                <span>{statusLabel}</span>
              </span>

              <button
                type="button"
                onClick={openSqlMovementsModal}
                className="flex items-center space-x-2 px-2 md:px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
                title="Ver movimientos SQL por identificar"
              >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline">SQL</span>
              </button>

              {deposit.estado === "rechazado" && (
                <button
                  type="button"
                  onClick={handleRestoreToPending}
                  disabled={isProcessing}
                  className="flex items-center space-x-2 px-2 md:px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  title="Restaurar depósito a pendiente"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden md:inline">Pendiente</span>
                </button>
              )}

              {/* Chatwoot desactivado */}
              {false && (
                  <>
                    <button
                      onClick={() => {}}
                      className="flex items-center space-x-2 px-2 md:px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                      title="Ver conversación de Chatwoot embebida"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden md:inline">Ver Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        void 0;
                      }}
                      className="flex items-center space-x-2 px-2 md:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                      title="Abrir conversación en Chatwoot (nueva pestaña)"
                    >
                      <PanelRightOpen className="h-4 w-4" />
                      <span className="hidden md:inline">Ir al Chat</span>
                    </button>
                  </>
                )}

              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {isLockedByOther && (
            <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/25 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 flex-shrink-0" />
                <span>
                  Este depósito está siendo validado por{" "}
                  <strong>{lockedByUser?.nombre || "otro usuario"}</strong>. Se muestra en solo lectura
                  hasta que lo libere.
                </span>
              </div>
            </div>
          )}

          {deposit.estado === "rechazado" &&
            rejectedObservationText.length > 0 && (
              <div
                className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-100"
                title={rejectedObservationSummary}
              >
                <div className="flex items-start gap-2">
                  <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-600 dark:text-red-300">
                    Observación del rechazo
                  </div>
                  <div className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-tight">
                    {rejectedObservationSummary}
                  </div>
                </div>
              </div>
            )}

          {/* Iframe de Chatwoot embebido */}

          <div
            className={`flex-1 min-h-0 overflow-y-auto lg:overflow-hidden ${
              isCompactPresentation ? "p-2.5 md:p-3" : "p-4"
            } bg-gray-50/50 dark:bg-gray-900/50`}
          >
            <div className={`grid h-full grid-cols-1 ${isCompactPresentation ? "gap-4 items-stretch lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]" : "gap-6 lg:grid-cols-9"}`}>
              <div className="space-y-3 lg:col-span-3 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-2">
                <div
                  className={`relative w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 border-l-4 ${getCardBorderColor(
                    "form",
                  )} rounded-lg p-2 shadow-md dark:shadow-black/30 hover:shadow-lg hover:shadow-slate-500/50 dark:hover:shadow-slate-400/40 transition-shadow duration-300`}
                >
                  {/* Mientras no llega el detalle completo (GET /v1/deposits/{id})
                      no mostramos el formulario a medias (empresa/anexo en rojo,
                      "campos requeridos faltantes" engañoso) -- se ve roto y
                      ademas confunde, porque esos campos SI estan cargados,
                      solo que todavia no llegaron del backend. Se tapa con un
                      loader hasta que editableData ya refleje el deposito real. */}
                  {!isDetailLoaded && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-[1px]">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Cargando detalle del depósito...
                      </span>
                    </div>
                  )}
                  <DepositFormPanel
                    editableData={editableData}
                    handleChange={handleChange}
                    isFieldsOnlyEdit={isFieldsOnlyEdit}
                    isFullEditDisabled={isFullEditDisabled}
                    activeEmpresas={activeEmpresas}
                    activeBancos={activeBancos}
                    filteredAnexos={filteredAnexos}
                    selectedMoneda={selectedMoneda}
                    nroOperacionClasses={nroOperacionClasses}
                    deposit={deposit}
                  />
                  {!isFieldsOnlyEdit && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                            Verificación de Duplicados
                          </h4>
                        </div>
                        <button
                          onClick={handleCheckDuplicates}
                          disabled={isChecking || !canCheckDuplicates}
                          className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium flex items-center justify-center disabled:bg-yellow-300 w-full sm:w-auto flex-shrink-0 text-sm"
                        >
                          {isChecking ? (
                            <Loader2 className="animate-spin mr-2" size={12} />
                          ) : (
                            <Search className="mr-2" size={12} />
                          )}
                          {isChecking
                            ? "Comprobando..."
                            : "Comprobar Duplicados"}
                        </button>
                      </div>
                      <AnimatePresence>
                        {checkResult.checked && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className={`mt-3 text-sm font-medium p-2.5 rounded-lg ${
                              isChecking
                                ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                                : checkResult.isDuplicate
                                  ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                                  : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {checkResult.isDuplicate ? (
                                  <Info size={12} />
                                ) : isChecking ? (
                                  <Search size={12} />
                                ) : (
                                  <CheckCircle size={12} />
                                )}
                                <span className="whitespace-pre-line">{checkResult.message}</span>
                              </div>
                              {checkResult.isDuplicate &&
                                duplicateDeposits.length > 0 && (
                                  <button
                                    onClick={() => {
                                      openDuplicateModal("duplicate");
                                    }}
                                    className="ml-3 inline-flex items-center space-x-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white flex-shrink-0 hover:bg-red-700"
                                  >
                                    <Eye size={12} />
                                    <span>Ver Duplicados</span>
                                  </button>
                                )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <div
                  className={`w-full bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 border-l-4 ${
                    editingSolicitante
                      ? "border-l-blue-500 dark:border-l-blue-400"
                      : getCardBorderColor("solicitante")
                  } rounded-lg p-2 shadow-md dark:shadow-black/30 hover:shadow-lg hover:shadow-indigo-500/50 dark:hover:shadow-indigo-400/40 transition-shadow duration-300`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Datos del Solicitante
                    </h4>
                  </div>

                  {editingSolicitante ? (
                    <div className="space-y-3">
                      {/* Campo de búsqueda de trabajador */}
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Buscar Vendedor (nombre o teléfono)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={searchTrabajador}
                            onChange={(e) =>
                              setSearchTrabajador(e.target.value)
                            }
                            placeholder="Escribe para buscar..."
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            autoComplete="off"
                          />
                          {buscandoTrabajador && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                            </div>
                          )}
                        </div>

                        {/* Lista de trabajadores encontrados */}
                        {trabajadoresEncontrados.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {trabajadoresEncontrados.map((trabajador) => (
                              <button
                                key={trabajador.id}
                                onClick={() =>
                                  seleccionarTrabajador(trabajador)
                                }
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 text-sm"
                              >
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {trabajador.nombre}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  📱 {trabajador.telefono_origen} • 🏢{" "}
                                  {trabajador.sucursal?.nombre ||
                                    "Sin sucursal"}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Datos seleccionados */}
                      {solicitanteData.trabajador_id && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div>
                              <span className="font-medium text-blue-800 dark:text-blue-200">
                                Vendedor:
                              </span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">
                                {solicitanteData.trabajador_nombre}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-blue-800 dark:text-blue-200">
                                Sucursal:
                              </span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">
                                {solicitanteData.sucursal_nombre ||
                                  "Sin sucursal"}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-blue-800 dark:text-blue-200">
                                Teléfono:
                              </span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">
                                {solicitanteData.telefono_origen}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Botones de acción */}
                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <button
                          onClick={cancelarEdicionSolicitante}
                          disabled={isProcessing}
                          className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={guardarCambiosSolicitante}
                          disabled={
                            isProcessing || !solicitanteData.trabajador_id
                          }
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                        >
                          {isProcessing ? (
                            <>
                              <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                              <span>Guardando...</span>
                            </>
                          ) : (
                            <span>Guardar</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                          <span
                            className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate"
                            title={deposit.sucursal?.nombre}
                          >
                            {deposit.sucursal?.nombre || "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <User className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                          <span
                            className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate"
                            title={deposit.trabajador?.nombre}
                          >
                            {deposit.trabajador?.nombre || "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                          <span className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
                            {deposit.trabajador?.telefono_origen || "-"}
                          </span>
                        </div>
                      </div>

                      {/* Chat flotante con el trabajador (solicitante) */}
                      {deposit.trabajador && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                          <button
                            type="button"
                            onClick={() =>
                              window.dispatchEvent(
                                new CustomEvent("confirmo:open-vendor-chat", {
                                  detail: {
                                    id: deposit.trabajador?.id,
                                    nombre: deposit.trabajador?.nombre,
                                    telefono: deposit.trabajador?.telefono_origen,
                                  },
                                }),
                              )
                            }
                            className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm flex items-center justify-center space-x-2 transition-colors"
                            title="Abrir chat con el trabajador"
                          >
                            <MessageSquare size={14} />
                            <span>Chat con el trabajador</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Mensaje de campos requeridos debajo del card Datos del Solicitante.
                    Se oculta mientras isDetailLoaded es false: recien sabemos
                    si de verdad faltan datos (o si solo no llego el detalle
                    todavia) una vez que editableData quedo inicializado con
                    la respuesta completa de GET /v1/deposits/{id}. */}
                {isDetailLoaded &&
                  (!editableData.empresa_id ||
                  !editableData.banco_id ||
                  !editableData.anexo ||
                  !selectedMoneda) && (
                  <div className="w-full p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                      ⚠️ Campos requeridos faltantes:
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 ml-4">
                      {!editableData.empresa_id && <li>• Empresa</li>}
                      {!editableData.banco_id && <li>• Banco</li>}
                      {!editableData.anexo && <li>• Anexo</li>}
                      {!selectedMoneda && <li>• Moneda</li>}
                    </ul>
                  </div>
                )}
              </div>

              <DepositVoucherPanel
                  displayVoucherUrl={displayVoucherUrl}
                  deposit={deposit}
                  setIsFloatingIframeOpen={setIsFloatingIframeOpen}
                  isLoading={!isDetailLoaded}
                />
            </div>
          </div>

          <div
            className={`flex flex-shrink-0 items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 ${
              isCompactPresentation ? "rounded-b-2xl p-3" : "rounded-b-xl p-4"
            }`}
          >
            <div className="mr-auto hidden md:block text-xs text-gray-500 dark:text-gray-400">
              Enter: confirmar · Esc: cerrar
            </div>
            {isFieldsOnlyEdit ? (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm"
                >
                  Cancelar
                </button>
                {displayVoucherUrl && (
                  <button
                    onClick={() =>
                      onOpenVoucherWindow(displayVoucherUrl, {
                        fecha_deposito:
                          editableData.fecha_deposito || deposit.fecha_deposito,
                        fechaDeposito:
                          editableData.fecha_deposito || deposit.fecha_deposito,
                        numero_operacion_solicitante: deposit.numero_operacion,
                        numero_operacion_banco:
                          editableData.numero_operacion_banco ||
                          deposit.numero_operacion_banco ||
                          "",
                        importe: editableData.monto || deposit.monto,
                        moneda: selectedMoneda || "",
                        cliente: editableData.cliente || deposit.cliente,
                        estado: deposit.estado,
                        sucursal: deposit.sucursal?.nombre || "",
                        banco:
                          deposit.banco?.abreviatura || deposit.banco?.nombre || "",
                        monto: editableData.monto || deposit.monto,
                        deposit_id: deposit.id,
                      })
                    }
                    className="px-2 md:px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium flex items-center justify-center space-x-2 text-sm"
                    title="Abrir panel lateral"
                  >
                    <PanelRightOpen size={12} />
                    <span className="hidden md:inline">Panel Lateral</span>
                  </button>
                )}
                <button
                  onClick={handleSaveChanges}
                  className="px-3 md:px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center space-x-2 text-sm"
                >
                  <Save size={12} />
                  <span className="hidden sm:inline">Guardar Cambios</span>
                  <span className="sm:hidden">Guardar</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm"
                >
                  Cancelar
                </button>
                {displayVoucherUrl && (
                  <button
                    onClick={() =>
                      onOpenVoucherWindow(displayVoucherUrl, {
                        fecha_deposito:
                          editableData.fecha_deposito || deposit.fecha_deposito,
                        fechaDeposito:
                          editableData.fecha_deposito || deposit.fecha_deposito,
                        numero_operacion_solicitante: deposit.numero_operacion,
                        numero_operacion_banco:
                          editableData.numero_operacion_banco ||
                          deposit.numero_operacion_banco ||
                          "",
                        importe: editableData.monto || deposit.monto,
                        moneda: selectedMoneda || "",
                        cliente: editableData.cliente || deposit.cliente,
                        estado: deposit.estado,
                        sucursal: deposit.sucursal?.nombre || "",
                        banco:
                          deposit.banco?.abreviatura || deposit.banco?.nombre || "",
                        monto: editableData.monto || deposit.monto,
                        deposit_id: deposit.id,
                      })
                    }
                    className="px-2 md:px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium flex items-center justify-center space-x-2 text-sm"
                    title="Abrir panel lateral"
                  >
                    <PanelRightOpen size={12} />
                    <span className="hidden md:inline">Panel Lateral</span>
                  </button>
                )}

                {/* Botón para marcar/desmarcar como antiguo - Solo para pendiente y en_validacion */}
                {(deposit.estado === "recibido" ||
                  deposit.estado === "en_validacion") && (
                  <button
                    onClick={handleToggleEsAntiguo}
                    disabled={isProcessing}
                    className={`px-3 py-1.5 rounded-md font-medium flex items-center justify-center space-x-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      deposit.es_antiguo
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500"
                    }`}
                    title={
                      deposit.es_antiguo
                        ? "Desmarcar como antiguo"
                        : "Marcar como antiguo"
                    }
                  >
                    <AlertTriangle size={12} />
                    <span>
                      {deposit.es_antiguo ? "Antiguo ✓" : "Marcar Antiguo"}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsRejectionModalOpen(true);
                  }}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium flex items-center justify-center space-x-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Ban size={12} />
                  <span>Rechazar</span>
                </button>

                {deposit.estado === "rechazado" && (
                  <button
                    onClick={handleRestoreToPending}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium flex items-center justify-center space-x-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    title="Restaurar depósito a pendiente"
                  >
                    <Clock size={12} />
                    <span>Volver a pendiente</span>
                  </button>
                )}

                {/* Regularizar voucher: solo finanzas/admin y SOLO cuando el
                    depósito ya está confirmado (validado). */}
                {canRegularize &&
                  deposit.estado === "confirmado" &&
                  !deposit.pendiente_regularizar && (
                  <button
                    onClick={handleMarkRegularize}
                    disabled={isMarkingRegularize}
                    className="px-3 py-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 font-medium flex items-center justify-center space-x-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    title="Marcar para regularizar el voucher (independiente del estado)"
                  >
                    <AlertTriangle size={12} />
                    <span>Regularizar</span>
                  </button>
                )}
                {canRegularize && deposit.pendiente_regularizar && (
                  <>
                    <button
                      onClick={() => setShowRegularizeUpload(true)}
                      className="px-3 py-1.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 font-medium flex items-center justify-center space-x-2 text-sm"
                      title="Subir la nueva imagen/pdf del voucher"
                    >
                      <UploadCloud size={12} />
                      <span>Subir imagen</span>
                    </button>
                    <button
                      onClick={handleUnmarkRegularize}
                      disabled={isMarkingRegularize}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 font-medium flex items-center justify-center space-x-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      title="Quitar la marca de regularizar"
                    >
                      <XCircle size={12} />
                      <span>Quitar marca</span>
                    </button>
                  </>
                )}

                {/* Grupo de confirmación */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleConfirmDeposit}
                    disabled={!canConfirm || isSending || isProcessing}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-2"
                    title="Confirmar depósito"
                  >
                    {isSending ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    <span>
                      {isSending ? "Enviando..." : "Confirmar"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Overlay de loading durante procesamiento */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center"
            style={{ pointerEvents: "all" }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Procesando...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Por favor espere mientras se completa la operación
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isRejectionModalOpen && (
        <RejectionModal
          onClose={() => setIsRejectionModalOpen(false)}
          onConfirm={handleConfirmRejection}
        />
      )}
      {showRegularizeUpload && (
        <RegularizeImageModal
          deposit={deposit}
          onClose={() => setShowRegularizeUpload(false)}
          onSubmit={handleSubmitRegularizeImage}
        />
      )}
      <ContactDetailsPortal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        contactRows={compactContactRows}
        phoneNumber={
          deposit?.trabajador?.telefono_origen || deposit?.sucursal?.telefono
        }
      />
      <FloatingVoucherPortal
        isOpen={isFloatingIframeOpen}
        onClose={() => setIsFloatingIframeOpen(false)}
        voucherUrl={displayVoucherUrl}
        operationNumber={deposit?.numero_operacion_banco}
      />
      <NoDuplicatePortal
        isOpen={duplicateModalMode === "no_duplicate"}
        onClose={() => {
          setDuplicateModalMode("none");
          setIsNoDuplicateModalOpen(false);
        }}
        snapshotText={compactStoreDataSnapshot}
        onConfirm={handleConfirmDeposit}
        onToggleOld={handleToggleEsAntiguo}
        canConfirm={canConfirm}
        isSending={isSending}
        isProcessing={isProcessing}
        isOld={!!deposit?.es_antiguo}
      />
      <DuplicateDepositsPortal
        isOpen={duplicateModalMode === "duplicate"}
        onClose={() => {
          setDuplicateModalMode("none");
          setIsDuplicatesModalOpen(false);
        }}
        onReject={() => {
          setDuplicateModalMode("none");
          setIsDuplicatesModalOpen(false);
          setIsRejectionModalOpen(true);
        }}
        duplicateDeposits={duplicateDeposits}
        empresas={empresas}
        bancos={bancos}
        getStatusInfo={getStatusInfo}
        formatCompactMoney={formatCompactMoney}
        formatDateTime={formatDepositDateTime}
      />

      {/* Modal de Chatwoot embebido */}
      <AnimatePresence>{false}</AnimatePresence>
    </>
  );
};

export default DepositDetailModal;


