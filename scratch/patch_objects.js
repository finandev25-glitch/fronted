import fs from "fs";

let apiCode = fs.readFileSync("src/features/deposits/api/depositsApi.js", "utf-8");

apiCode = apiCode.replace(
  `function mapBanco(banco) {
  return {`,
  `function mapBanco(banco) {
  if (!banco) return null;
  return {`
);

apiCode = apiCode.replace(
  `function mapEmpresa(empresa) {
  return {`,
  `function mapEmpresa(empresa) {
  if (!empresa) return null;
  return {`
);

apiCode = apiCode.replace(
  `empresa: null,
    banco: null,
    sucursal: null,
    trabajador: null,`,
  `empresa: item.empresa ? mapEmpresa(item.empresa) : null,
    banco: item.banco ? mapBanco(item.banco) : null,
    sucursal: item.sucursal || null,
    trabajador: item.trabajador || null,`
);

fs.writeFileSync("src/features/deposits/api/depositsApi.js", apiCode);
console.log("Patched depositsApi.js to map objects");

let modalCode = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

modalCode = modalCode.replace(
  `empresa_id: deposit.empresa?.id || "",
        banco_id: deposit.banco?.id || "",`,
  `empresa_id: deposit.empresa?.id || deposit.empresa_id || "",
        banco_id: deposit.banco?.id || deposit.banco_id || "",`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", modalCode);
console.log("Patched DepositDetailModal.jsx to use fallback ids");
