import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

code = code.replace(
  /const anexos = \[\.\.\.new Set\(fetchedCuentas\.map\(\(c\) => c\.anexo \|\| c\.Anexo\)\)\]\.filter\(Boolean\);/,
  `console.log(">>> fetchedCuentas recibido:", fetchedCuentas);
          const anexos = [...new Set(fetchedCuentas.map((c) => c.anexo || c.Anexo))].filter(Boolean);
          console.log(">>> anexos computados antes de setState:", anexos);`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Added console.log statements to debug anexos.");
