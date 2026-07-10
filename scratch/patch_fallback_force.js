import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

code = code.replace(
  /empresa_id: deposit\.empresa\?\.id \|\| "",\s*banco_id: deposit\.banco\?\.id \|\| "",/,
  `empresa_id: String(deposit.empresa?.id || deposit.empresa_id || "").toLowerCase(),
        banco_id: String(deposit.banco?.id || deposit.banco_id || "").toLowerCase(),`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Forced fallback and lowercase in DepositDetailModal.jsx");
