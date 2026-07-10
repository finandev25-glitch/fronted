import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

if (!code.includes("lastInitializedDepositId = useRef")) {
  const matchStr = "  const selectedMoneda = normalizeDepositCurrency(editableData.moneda);";
  const replacement = matchStr + "\n\n  const lastInitializedDepositId = useRef(null);";
  code = code.replace(matchStr, replacement);
  fs.writeFileSync(filePath, code);
  console.log("useRef declaration successfully injected!");
} else {
  console.log("useRef already declared.");
}
