import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

if (!code.includes("fetchCuentas")) {
  code = code.replace(
    /import \{ apiGet, apiPost, apiPut \} from "\.\.\/\.\.\/\.\.\/services\/backendApi\.js";/,
    `import { apiGet, apiPost, apiPut } from "../../../services/backendApi.js";\nimport { fetchCuentas } from "../../deposits/api/depositsApi.js";`
  );
  
  if (!code.includes("fetchCuentas")) {
     // Fallback: prepend to the top of the file
     code = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";\n` + code;
  }
}

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Added fetchCuentas import safely.");
