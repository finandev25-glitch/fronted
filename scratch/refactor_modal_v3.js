/**
 * refactor_modal_v3.js
 * 
 * Versión corregida: el corte del estado empieza después de TODA la declaración de estado,
 * apuntando al primer handler/callback que no es estado puro.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const legacyPath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.legacy.jsx");
const newPath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");

const legacy = fs.readFileSync(legacyPath, "utf-8");

// ─── Punto de corte inferior: empieza el JSX + cómputos pre-return ─────────
const JSX_CUTPOINT = `  const sqlActiveVoucherUrl = useMemo`;
const jsxIdx = legacy.indexOf(JSX_CUTPOINT);
if (jsxIdx === -1) { console.error("No JSX_CUTPOINT"); process.exit(1); }
const jsxAndDown = legacy.substring(jsxIdx);

// ─── Punto de corte superior: empieza la lógica (después del estado) ────────
// El primer callback después del estado es "isTypingTarget"
const LOGIC_START = `  const isTypingTarget = useCallback`;
const logicIdx = legacy.indexOf(LOGIC_START);
if (logicIdx === -1) { console.error("No LOGIC_START"); process.exit(1); }
const logicSection = legacy.substring(logicIdx, jsxIdx);

console.log(`Lógica extraída: ${(logicSection.length/1024).toFixed(1)} KB`);
console.log(`JSX extraído:    ${(jsxAndDown.length/1024).toFixed(1)} KB`);
console.log(`Primeros 150 chars lógica: ${logicSection.substring(0, 150)}`);

// ─── Nuevo archivo completo ──────────────────────────────────────────────────
const newFile = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";
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
  X, User, Building2, CreditCard, Calendar, Clock, DollarSign,
  CheckCircle, XCircle, AlertCircle, FileText, Hash, Building, Info,
  Search, Loader2, Ban, MessageSquare, PanelRightOpen, Save, Fingerprint,
  Eye, AlertTriangle, Phone, FileDown, ExternalLink,
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
  onOpenVoucherWindow,
  editMode = "full",
  presentationMode = "default",
  replyToWhatsAppMessages = false,
}) => {
  const isCompactPresentation = presentationMode === "compact";
  const shouldUseDuplicateModals = isCompactPresentation;
  const { currentUser } = useContext(AuthContext);
  const isBackendConnected = !!currentUser;

  // ─── Estado del formulario ──────────────────────────────────────────────────
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

  // ─── Estado de modales y UI ─────────────────────────────────────────────────
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

  // ─── Estado de mensajería y acciones ───────────────────────────────────────
  const [yCloudConfigId, setYCloudConfigId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [yCloudConfigs, setYCloudConfigs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // ─── Estado de edición del solicitante ─────────────────────────────────────
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

${logicSection}
${jsxAndDown}
`;

fs.writeFileSync(newPath, newFile, "utf-8");
const originalSize = fs.statSync(legacyPath).size;
const newSize = fs.statSync(newPath).size;
console.log(`\n✅ Refactor completado exitosamente:`);
console.log(`  Original (legacy): ${(originalSize/1024).toFixed(1)} KB`);
console.log(`  Nuevo:             ${(newSize/1024).toFixed(1)} KB`);
