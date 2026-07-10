import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

// We need to inject the useRef declaration.
// Let's find the exact useEffect declaration. It has this shape:
// "  useEffect(() => {\r\n    if (deposit) {\r\n" or similar.
// We can use a regex that handles whitespace flexibly.

const regex = /useEffect\(\(\) => \{\s*if \(deposit\) \{\s*if \(lastInitializedDepositId\.current/g;

if (regex.test(code)) {
    code = code.replace(/useEffect\(\(\) => \{\s*if \(deposit\) \{\s*if \(lastInitializedDepositId\.current/g, 
        `const lastInitializedDepositId = useRef(null);\n  useEffect(() => {\n    if (deposit) {\n      if (lastInitializedDepositId.current`);
    console.log("Fixed missing useRef declaration.");
} else {
    console.log("Regex did not match.");
}

fs.writeFileSync(filePath, code);
