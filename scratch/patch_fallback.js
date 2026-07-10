import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

code = code.replace(
  `empresa_id: deposit.empresa?.id || "",
        banco_id: deposit.banco?.id || "",`,
  `empresa_id: deposit.empresa?.id || deposit.empresa_id || "",
        banco_id: deposit.banco?.id || deposit.banco_id || "",`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Updated fallback in DepositDetailModal.jsx");
