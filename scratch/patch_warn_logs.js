import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

code = code.replace(
  /console\.log\(">>> fetchedCuentas recibido:", fetchedCuentas\);/,
  `console.warn(">>> ATENCION: fetchedCuentas recibido:", fetchedCuentas);`
);
code = code.replace(
  /console\.log\(">>> anexos computados antes de setState:", anexos\);/,
  `console.warn(">>> ATENCION: anexos computados antes de setState:", anexos);`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Changed logs to console.warn to bypass filters.");
