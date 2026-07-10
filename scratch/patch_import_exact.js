import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

if (!code.includes("useRef,")) {
  code = code.replace("  useCallback,\n} from \"react\";", "  useCallback,\n  useRef,\n} from \"react\";");
  fs.writeFileSync(filePath, code);
  console.log("Injected useRef import successfully.");
} else {
  console.log("useRef already imported.");
}
