import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

// We will replace the useEffect that initializes editableData to use a ref to prevent overwriting user input

const regexUseEffectInit = /useEffect\(\(\) => \{\s*if \(deposit\) \{\s*setEditableData\(\{[\s\S]*?\}\);\s*\}\s*\}, \[deposit\]\);/g;

// First we need to make sure useRef is imported. It is already imported at the top of the file.
// We'll inject the ref just above the useEffect.

const oldInitBlock = `  useEffect(() => {
    if (deposit) {
      setEditableData({
        empresa_id: deposit.empresa?.id || "",
        banco_id: deposit.banco?.id || "",
        anexo: deposit.anexo || "",
        monto: deposit.monto || 0,
        moneda: normalizeDepositCurrency(deposit.moneda),
        numero_operacion_banco:
          deposit.numero_operacion_banco || deposit.numero_operacion || "",
        fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),
        imagen_voucher: deposit.imagen_voucher || "",
        cliente: deposit.cliente || "",
        ruc_cliente: deposit.ruc_cliente || "",
        observaciones: deposit.observaciones || "",
        referencia_cliente: deposit.referencia_cliente || "",
      });

      // Inicializar datos del solicitante
      setSolicitanteData({
        trabajador_id: deposit.trabajador?.id || null,
        trabajador_nombre: deposit.trabajador?.nombre || "",
        sucursal_id: deposit.sucursal?.id || null,
        sucursal_nombre: deposit.sucursal?.nombre || "",
      });
      
      setSelectedMoneda(normalizeDepositCurrency(deposit.moneda));
    }
  }, [deposit]);`;

const newInitBlock = `  const lastInitializedDepositId = useRef(null);

  useEffect(() => {
    if (deposit) {
      // Solo inicializar los campos editables la PRIMERA VEZ que se abre este depósito
      // Si llegan actualizaciones por WebSocket (mismo ID), NO sobrescribir lo que el usuario está editando.
      if (lastInitializedDepositId.current !== deposit.id) {
        setEditableData({
          empresa_id: deposit.empresa?.id || "",
          banco_id: deposit.banco?.id || "",
          anexo: deposit.anexo || "",
          monto: deposit.monto || 0,
          moneda: normalizeDepositCurrency(deposit.moneda),
          numero_operacion_banco:
            deposit.numero_operacion_banco || deposit.numero_operacion || "",
          fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),
          imagen_voucher: deposit.imagen_voucher || "",
          cliente: deposit.cliente || "",
          ruc_cliente: deposit.ruc_cliente || "",
          observaciones: deposit.observaciones || "",
          referencia_cliente: deposit.referencia_cliente || "",
        });

        // Inicializar datos del solicitante
        setSolicitanteData({
          trabajador_id: deposit.trabajador?.id || null,
          trabajador_nombre: deposit.trabajador?.nombre || "",
          sucursal_id: deposit.sucursal?.id || null,
          sucursal_nombre: deposit.sucursal?.nombre || "",
        });
        
        setSelectedMoneda(normalizeDepositCurrency(deposit.moneda));
        lastInitializedDepositId.current = deposit.id;
      }
    }
  }, [deposit]);`;

// Use replace with string literal first to be safe
if (code.includes("setEditableData({\n        empresa_id: deposit.empresa?.id || \"\",")) {
  const codeParts = code.split(/useEffect\(\(\) => \{\s*if \(deposit\) \{\s*setEditableData\(\{/);
  if (codeParts.length === 2) {
      // It's a bit risky to use split if there are multiple matches, but there should be only one initialization of editableData based on deposit
  }
}

// Safer approach: Use a focused regex to replace the specific useEffect block
const targetedRegex = /useEffect\(\(\) => \{\s*if \(deposit\) \{\s*setEditableData\(\{(?:[\s\S]*?\}\);\s*\}){2}\s*setSelectedMoneda[\s\S]*?\}\s*\}, \[deposit\]\);/m;

if (targetedRegex.test(code)) {
    code = code.replace(targetedRegex, newInitBlock);
    console.log("Initialization useEffect successfully patched to prevent overwrite.");
} else {
    console.log("Could not find the exact initialization useEffect block.");
}


fs.writeFileSync(filePath, code);
