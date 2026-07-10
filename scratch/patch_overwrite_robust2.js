import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

const regexSetEditableData = /setEditableData\(\{\s*empresa_id: deposit\.empresa\?\.id \|\| "",\s*banco_id: deposit\.banco\?\.id \|\| "",\s*anexo: deposit\.anexo \|\| "",[\s\S]*?referencia_cliente: deposit\.referencia_cliente \|\| "",\s*\}\);/g;

const newSetEditableData = `      if (lastInitializedDepositId.current !== deposit.id) {
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
        lastInitializedDepositId.current = deposit.id;
      }`;

if (regexSetEditableData.test(code)) {
  code = code.replace(regexSetEditableData, newSetEditableData);
  console.log("Bloque setEditableData envuelto correctamente con regex.");
} else {
  console.log("ERROR: No se encontró originalSetEditableData con regex tampoco");
}

fs.writeFileSync(filePath, code);
