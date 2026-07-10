import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

if (!code.includes("import { fetchCuentas }") && !code.includes("import { updateDeposit, fetchCuentas }")) {
  code = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";\n` + code;
}

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Added fetchCuentas import safely (fixed logic).");
