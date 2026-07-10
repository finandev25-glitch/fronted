import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

if (!code.includes("const lastInitializedDepositId = useRef(null);")) {
  code = code.replace("  const selectedMoneda = normalizeDepositCurrency(editableData.moneda);\n\n  useEffect(() => {\n    if (deposit) {\n", 
    "  const selectedMoneda = normalizeDepositCurrency(editableData.moneda);\n\n  const lastInitializedDepositId = useRef(null);\n  useEffect(() => {\n    if (deposit) {\n");
  fs.writeFileSync(filePath, code);
  console.log("Injected useRef successfully using exact string matching.");
} else {
  console.log("useRef already exists.");
}
