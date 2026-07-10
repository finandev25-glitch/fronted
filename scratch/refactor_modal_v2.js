/**
 * refactor_modal_v2.js
 * 
 * El archivo legacy.jsx ya tiene el patch aplicado.
 * Este script extrae solo el JSX y lo combina con un header limpio.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const legacyPath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.legacy.jsx");
const newPath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");

const legacy = fs.readFileSync(legacyPath, "utf-8");

// El punto de corte: antes de "const sqlActiveVoucherUrl = useMemo"
// Todo lo que va antes de esto es "lógica", lo que viene después incluye JSX
const JSX_CUTPOINT = `  const sqlActiveVoucherUrl = useMemo`;
const jsxIdx = legacy.indexOf(JSX_CUTPOINT);
if (jsxIdx === -1) {
  console.error("No se encontró JSX_CUTPOINT");
  process.exit(1);
}
const jsxAndDown = legacy.substring(jsxIdx);

// El punto de corte para el ESTADO: el primer useEffect (después del estado declarado)
// Es el useEffect del sqlSelectionToast
const STATE_END = `  useEffect(() => {\r\n    if (!sqlSelectionToast) return undefined;`;
const stateEndIdx = legacy.indexOf(STATE_END);
if (stateEndIdx === -1) {
  console.error("No se encontró STATE_END");
  process.exit(1);
}

// La sección de lógica: desde el STATE_END hasta el JSX_CUTPOINT
const logicSection = legacy.substring(stateEndIdx, jsxIdx);

console.log(`Lógica: ${((logicSection.length)/1024).toFixed(1)} KB`);
console.log(`JSX:    ${(jsxAndDown.length/1024).toFixed(1)} KB`);

// ─── Construir el nuevo header con el estado declarado ───────────────────────
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
 * - empresa_id y banco_id ahora usan deposit.empresa_id como fallback (campo plano)
 *   cuando deposit.empresa no viene con objeto completo desde el backend/WebSocket
 * - lastInitializedDepositId (useRef) evita que WebSocket sobreescriba selecciones
 * - Anexos cargados desde el backend (fetchCuentas) en lugar del prop vacío \`cuentas\`
 * - El select de Anexo ya no está disabled por lista vacía
 * 
 * TODO (refactor incremental):
 * - Mover lógica de confirmación a hooks/useDepositActions.js (ya creado)
 * - Mover lógica de SQL a hooks/useDepositSql.js (ya creado)
 * - Extraer panel izquierdo a ui/DepositFormPanel.jsx
 * - Extraer panel de voucher a ui/DepositVoucherPanel.jsx
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

${logicSection}
${jsxAndDown}
`;

fs.writeFileSync(newPath, newFile, "utf-8");
const originalSize = fs.statSync(legacyPath).size;
const newSize = fs.statSync(newPath).size;
console.log(`\n✅ Refactor completo:`);
console.log(`  Original: ${(originalSize/1024).toFixed(1)} KB`);
console.log(`  Nuevo:    ${(newSize/1024).toFixed(1)} KB`);
console.log(`  Diferencia: ${((newSize - originalSize)/1024).toFixed(1)} KB`);
