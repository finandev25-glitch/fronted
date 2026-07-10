/**
 * refactor_modal.js
 * 
 * Crea el nuevo DepositDetailModal.jsx usando los hooks extraídos.
 * 
 * Estrategia:
 * 1. Lee el archivo legacy (original)
 * 2. Extrae SOLO el JSX (return statement hasta el final)  
 * 3. Construye el nuevo archivo con los hooks + el JSX original
 * 4. Sobrescribe DepositDetailModal.jsx con el archivo más limpio
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const legacyPath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.legacy.jsx");
const newPath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");

const legacy = fs.readFileSync(legacyPath, "utf-8");

// ─── Encontrar donde empieza el return del JSX ──────────────────────────────
// El return principal empieza en la línea que tiene "const sqlMovementsModalPortal ="
// Pero necesitamos incluir toda la lógica del "portal" y el return final.
// Lo más seguro es cortar después de buildUpdatePayload y los handlers.

// Encontrar el punto de corte: justo antes del "sqlMovementsModalPortal"
// que es la primera pieza de JSX computado antes del return
const cutMarker = `  const sqlActiveVoucherUrl = useMemo`;
const cutIndex = legacy.indexOf(cutMarker);

if (cutIndex === -1) {
  console.error("No se encontró el marcador de corte. Abortando.");
  process.exit(1);
}

// El JSX que vamos a preservar: desde sqlActiveVoucherUrl hasta el final del archivo
// (excluyendo el último "export default DepositDetailModal;" que vamos a agregar)
const jsxSection = legacy.substring(cutIndex);

console.log(`Tamaño del JSX a preservar: ${jsxSection.length} bytes`);
console.log(`Primeras 200 chars del JSX: ${jsxSection.substring(0, 200)}`);

// ─── Construir el nuevo archivo ──────────────────────────────────────────────
const newHeader = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";
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
import useWhatsApp from "../../../hooks/useWhatsApp.js";
import yCloudService from "../../../services/yCloudService.js";
import { apiGet, apiPost, apiPut } from "../../../services/backendApi.js";
import {
  X,
  User,
  Building2,
  CreditCard,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Hash,
  Building,
  Info,
  Search,
  Loader2,
  Ban,
  MessageSquare,
  PanelRightOpen,
  Save,
  Fingerprint,
  Eye,
  AlertTriangle,
  Phone,
  FileDown,
  ExternalLink,
} from "lucide-react";
import RejectionModal from "../../../components/RejectionModal";
import GoogleDrivePicker from "../../../components/GoogleDrivePicker.jsx";
import ConversationModal from "../../../components/ConversationModal.jsx";
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
 * Cambios principales respecto al legacy:
 * - Estado del formulario gestionado con useRef para prevenir re-init por WebSocket
 * - empresa_id y banco_id usan fallback deposit.empresa_id (campo plano) además del objeto anidado
 * - Anexos cargados desde el backend (fetchCuentas) en lugar del prop local \`cuentas\`
 * - El campo Anexo nunca está disabled por lista vacía
 */
const DepositDetailModal = ({
  deposit,
  onClose,
  onUpdateDeposit,
  empresas,
  bancos,
  cuentas,
  onOpenVoucherWindow,
  editMode = "full",
  presentationMode = "default",
  replyToWhatsAppMessages = false,
}) => {
  const isCompactPresentation = presentationMode === "compact";
  const shouldUseDuplicateModals = isCompactPresentation;
  const { currentUser } = useContext(AuthContext);
  const isBackendConnected = !!currentUser;

  // ─── Estado del formulario editable ────────────────────────────────────────
  const [editableData, setEditableData] = useState({
    empresa_id: "",
    banco_id: "",
    anexo: "",
    monto: 0,
    moneda: "PEN",
    numero_operacion_banco: "",
    fecha_deposito: "",
    imagen_voucher: "",
    cliente: "",
    ruc_cliente: "",
    observaciones: "",
    referencia_cliente: "",
  });
  const [filteredAnexos, setFilteredAnexos] = useState([]);

  // ─── Estado de UI ───────────────────────────────────────────────────────────
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState({ checked: false, isDuplicate: false, message: "" });
  const [duplicateDeposits, setDuplicateDeposits] = useState([]);
  const [isNoDuplicateModalOpen, setIsNoDuplicateModalOpen] = useState(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [duplicateModalMode, setDuplicateModalMode] = useState("none");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [isSqlMovementsModalOpen, setIsSqlMovementsModalOpen] = useState(false);
  const [sqlMovementsLoading, setSqlMovementsLoading] = useState(false);
  const [sqlMovementsError, setSqlMovementsError] = useState("");
  const [sqlMovementsActionMessage, setSqlMovementsActionMessage] = useState("");
  const [sqlMovementsRows, setSqlMovementsRows] = useState([]);
  const [sqlMovementsMeta, setSqlMovementsMeta] = useState(null);
  const [sqlCortadoLoading, setSqlCortadoLoading] = useState(false);
  const [sqlCortadoError, setSqlCortadoError] = useState("");
  const [sqlCortadoRows, setSqlCortadoRows] = useState([]);
  const [sqlCortadoMeta, setSqlCortadoMeta] = useState(null);
  const [sqlMovementsSearch, setSqlMovementsSearch] = useState("");
  const [sqlCortadoPeriod, setSqlCortadoPeriod] = useState("");
  const [sqlCortadoNroOperacionFilter, setSqlCortadoNroOperacionFilter] = useState("");
  const [sqlCortadoBancoFilter, setSqlCortadoBancoFilter] = useState("");
  const [sqlCortadoFechaFilter, setSqlCortadoFechaFilter] = useState("");
  const [sqlCortadoImporteFilter, setSqlCortadoImporteFilter] = useState("");
  const [sqlCortadoPage, setSqlCortadoPage] = useState(1);
  const [sqlCortadoPageSize] = useState(100);
  const [sqlCortadoTotalCount, setSqlCortadoTotalCount] = useState(0);
  const [sqlActiveTab, setSqlActiveTab] = useState("movimientos");
  const [sqlSelectedMovement, setSqlSelectedMovement] = useState(null);
  const [sqlSelectionToast, setSqlSelectionToast] = useState("");
  const sqlSelectedMovementId = sqlSelectedMovement?.ID ?? null;
  const isSqlLoading = sqlMovementsLoading || sqlCortadoLoading;
  const [duplicateStoreDataSnapshot, setDuplicateStoreDataSnapshot] = useState("");
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFloatingIframeOpen, setIsFloatingIframeOpen] = useState(false);
  const [compactSearchStatus, setCompactSearchStatus] = useState("Busca por nro. operación o importe en la pestaña activa.");
  const [compactSearchTone, setCompactSearchTone] = useState("neutral");
  const [isCompactSearching, setIsCompactSearching] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("");
  const [receivedTime, setReceivedTime] = useState("");
  const [yCloudConfigId, setYCloudConfigId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [yCloudConfigs, setYCloudConfigs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingSolicitante, setEditingSolicitante] = useState(false);
  const [searchTrabajador, setSearchTrabajador] = useState("");
  const [trabajadoresEncontrados, setTrabajadoresEncontrados] = useState([]);
  const [buscandoTrabajador, setBuscandoTrabajador] = useState(false);
  const [solicitanteData, setSolicitanteData] = useState({
    trabajador_id: null,
    trabajador_nombre: "",
    sucursal_id: null,
    sucursal_nombre: "",
    telefono_origen: "",
  });

  // ─── FIX: useRef para evitar re-init por WebSocket ──────────────────────────
  // Sin esto, cada vez que el WebSocket actualiza el depósito, se resetean
  // los campos empresa_id, banco_id y anexo que el usuario ya seleccionó.
  const lastInitializedDepositId = useRef(null);

`;

// ─── Construir el resto del archivo desde el legacy ─────────────────────────
// Necesitamos:
// A) Los effects de timer, SQL, yCloud (líneas 150-993 del legacy)
// B) Los handlers (líneas 1050-2100 del legacy)  
// C) El JSX (líneas 2100-end del legacy)
//
// Pero el useEffect de inicialización (línea 935) lo reemplazamos con el fixed.

// Encontrar el bloque del useEffect de sqlSelectionToast (que es lo que sigue al estado)
const sqlToastEffect = `  useEffect(() => {\r\n    if (!sqlSelectionToast) return undefined;\r\n    const timeoutId = setTimeout(() => {\r\n      setSqlSelectionToast(\"\");\r\n    }, 2500);\r\n    return () => clearTimeout(timeoutId);\r\n  }, [sqlSelectionToast]);`;
const sqlToastIdx = legacy.indexOf(sqlToastEffect);

if (sqlToastIdx === -1) {
  console.error("No se encontró sqlToastEffect. Abortando.");
  process.exit(1);
}

// Tomar desde el sqlToastEffect hasta antes del useEffect de inicialización del formulario
// (el que vamos a reemplazar con la versión fixed)
const initEffectMarker = `  useEffect(() => {\r\n    if (deposit) {\r\n      setEditableData({\r\n        empresa_id: deposit.empresa?.id || "",`;
const initEffectIdx = legacy.indexOf(initEffectMarker);

if (initEffectIdx === -1) {
  console.error("No se encontró initEffect marker. Abortando.");
  process.exit(1);
}

// La sección entre el toast effect y el initEffect (es básicamente el whatsapp hook y el isTypingTarget)
const betweenSection = legacy.substring(sqlToastIdx, initEffectIdx);

// El useEffect de anexos que viene DESPUÉS del init effect
const anexosEffectMarker = `  useEffect(() => {\r\n    if (editableData.empresa_id && editableData.banco_id) {\r\n      const relevantCuentas = cuentas.filter(`;
const anexosEffectIdx = legacy.indexOf(anexosEffectMarker);

// El cierre del init effect + los datos del solicitante
const initToAnexosSection = legacy.substring(initEffectIdx, anexosEffectIdx !== -1 ? anexosEffectIdx : initEffectIdx + 500);

// Lo que viene después del useEffect de anexos (yCloud, timers, handlers...)
const afterAnexosMarker = `  // Chatwoot fue desactivado;`;
const afterAnexosIdx = legacy.indexOf(afterAnexosMarker);
const restOfLogic = afterAnexosIdx !== -1 ? legacy.substring(afterAnexosIdx) : "";

// Encontrar hasta dónde va la lógica (antes del sqlActiveVoucherUrl useMemo)
const logicEnd = restOfLogic.indexOf(cutMarker);
const logicSection = logicEnd !== -1 ? restOfLogic.substring(0, logicEnd) : restOfLogic;

// ─── Init effect fixed ───────────────────────────────────────────────────────
const fixedInitEffect = `  useEffect(() => {
    if (deposit) {
      // FIX: solo inicializar cuando cambia el depósito, no en cada actualización de WebSocket
      if (lastInitializedDepositId.current !== deposit.id) {
        setEditableData({
          // FIX: fallback a deposit.empresa_id cuando deposit.empresa no viene con objeto completo
          empresa_id: deposit.empresa?.id || deposit.empresa_id || "",
          banco_id: deposit.banco?.id || deposit.banco_id || "",
          anexo: deposit.anexo || "",
          monto: deposit.monto || 0,
          moneda: normalizeDepositCurrency(deposit.moneda),
          numero_operacion_banco:
            deposit.numero_operacion_banco || deposit.numero_operacion || "",
          fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),
          // FIX: múltiples fallbacks para la imagen del voucher
          imagen_voucher: deposit.imagen_voucher || deposit.imagenUrl || deposit.imagenVoucher || "",
          cliente: deposit.cliente || "",
          ruc_cliente: deposit.ruc_cliente || "",
          observaciones: deposit.observaciones || "",
          referencia_cliente: deposit.referencia_cliente || "",
        });
        lastInitializedDepositId.current = deposit.id;
      }

      // Inicializar datos del solicitante`;

// ─── Anexos effect fixed (backend API) ──────────────────────────────────────
const fixedAnexosEffect = `  // FIX: cargar Anexos desde el backend, no del prop local \`cuentas\`
  useEffect(() => {
    let isMounted = true;
    async function loadAnexos() {
      if (!editableData.empresa_id || !editableData.banco_id) {
        if (isMounted) setFilteredAnexos([]);
        return;
      }
      try {
        const cuentasBancarias = await fetchCuentas(editableData.empresa_id, editableData.banco_id);
        if (!isMounted) return;
        const anexos = [...new Set(cuentasBancarias.map((c) => c.anexo || c.Anexo))].filter(Boolean);
        setFilteredAnexos(anexos);
      } catch (err) {
        console.error("Error cargando anexos:", err);
        if (isMounted) setFilteredAnexos([]);
      }
    }
    loadAnexos();
    return () => { isMounted = false; };
  }, [editableData.empresa_id, editableData.banco_id]);

`;

// ─── Encontrar dónde termina el init effect (antes de setSolicitanteData) ───
const solicitanteInit = `      // Inicializar datos del solicitante`;
const solicitanteInitEndMarker = `      setCheckResult({ checked: false, isDuplicate: false, message: "" });\r\n      setIsChecking(false);\r\n      setSqlMovementsSearch("");\r\n      setSqlMovementsRows([]);\r\n      setSqlMovementsMeta(null);\r\n      setSqlMovementsError("");\r\n      setIsSqlMovementsModalOpen(false);\r\n\r\n    }\r\n  }, [deposit]);`;

const initEffectEnd = legacy.indexOf(solicitanteInitEndMarker, initEffectIdx);
const initEffectBody = initEffectEnd !== -1 ? legacy.substring(legacy.indexOf(solicitanteInit, initEffectIdx), initEffectEnd + solicitanteInitEndMarker.length) : "";

// Componer el nuevo archivo
const newContent = newHeader +
  betweenSection + "\r\n" +
  fixedInitEffect + "\r\n" +
  initEffectBody + "\r\n\r\n" +
  fixedAnexosEffect +
  logicSection +
  jsxSection;

fs.writeFileSync(newPath, newContent, "utf-8");
const finalSize = fs.statSync(newPath).size;
const originalSize = fs.statSync(legacyPath).size;

console.log(`\n✅ Refactor completo:`);
console.log(`  Original: ${(originalSize / 1024).toFixed(1)} KB`);
console.log(`  Nuevo:    ${(finalSize / 1024).toFixed(1)} KB`);
console.log(`  Reducción: ${(((originalSize - finalSize) / originalSize) * 100).toFixed(1)}%`);
