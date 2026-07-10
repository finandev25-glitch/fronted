import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

// 1. Inject fetchCuentas
if (!code.includes("fetchCuentas")) {
    code = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";\n` + code;
    console.log("Injected fetchCuentas");
}

// 2. Inject useRef
if (!code.includes("useRef,")) {
    // We'll just replace the whole React import
    const reactImportRegex = /import React, \{[\s\S]*?\} from "react";/;
    code = code.replace(reactImportRegex, `import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";`);
    console.log("Injected useRef import");
}

fs.writeFileSync(filePath, code);
