import fs from "fs";

let apiCode = fs.readFileSync("src/features/deposits/api/depositsApi.js", "utf-8");

apiCode = apiCode.replace(
  /function mapBanco[\s\S]*?function mapEmpresa[\s\S]*?estado: "activo",\s*};\s*}/,
  `function mapBanco(banco) {
  if (!banco) return null;
  return {
    id: String(banco.id || banco.Id || "").toLowerCase(),
    nombre: banco.nombre || "",
    abreviatura: banco.codigo || banco.nombre || "",
    estado: "activo",
  };
}

function mapEmpresa(empresa) {
  if (!empresa) return null;
  return {
    id: String(empresa.id || empresa.Id || "").toLowerCase(),
    nombre: empresa.nombre || empresa.Nombre || "",
    abreviatura: empresa.nombre || empresa.Nombre || "",
    logo: empresa.logo || empresa.Logo || null,
    estado: "activo",
  };
}

function mapSucursal(sucursal) {
  if (!sucursal) return null;
  return {
    id: String(sucursal.id || sucursal.Id || "").toLowerCase(),
    empresa_id: String(sucursal.empresaId || sucursal.EmpresaId || "").toLowerCase(),
    nombre: sucursal.nombre || sucursal.Nombre || "",
    direccion: sucursal.direccion || sucursal.Direccion || "",
    estado: (sucursal.activo || sucursal.Activo) ? "activo" : "inactivo",
  };
}

function mapTrabajador(trabajador) {
  if (!trabajador) return null;
  return {
    id: String(trabajador.id || trabajador.Id || "").toLowerCase(),
    empresa_id: String(trabajador.empresaId || trabajador.EmpresaId || "").toLowerCase(),
    sucursal_id: String(trabajador.sucursalId || trabajador.SucursalId || "").toLowerCase(),
    nombre: trabajador.nombre || trabajador.Nombre || "",
    telefono_origen: trabajador.telefonoPersonal || trabajador.TelefonoPersonal || "",
    estado: (trabajador.activo || trabajador.Activo) ? "activo" : "inactivo",
  };
}`
);

// Map full objects in mapDeposit
apiCode = apiCode.replace(
  `empresa: item.empresa ? mapEmpresa(item.empresa) : null,
    banco: item.banco ? mapBanco(item.banco) : null,
    sucursal: item.sucursal || null,
    trabajador: item.trabajador || null,`,
  `empresa_id: item.empresaId ? String(item.empresaId).toLowerCase() : null,
    banco_id: item.bancoId ? String(item.bancoId).toLowerCase() : null,
    sucursal_id: item.sucursalId ? String(item.sucursalId).toLowerCase() : null,
    trabajador_id: item.trabajadorId || item.vendedorId ? String(item.trabajadorId || item.vendedorId).toLowerCase() : null,
    empresa: item.empresa ? mapEmpresa(item.empresa) : null,
    banco: item.banco ? mapBanco(item.banco) : null,
    sucursal: item.sucursal ? mapSucursal(item.sucursal) : null,
    trabajador: item.trabajador ? mapTrabajador(item.trabajador) : null,`
);

// Fix fetch functions mapping
apiCode = apiCode.replace(
  `export async function fetchSucursales() {
  if (MOCK_MODE_ENABLED) return getMockState().sucursales;

  console.warn("fetchSucursales: el backend no expone sucursales todavia.");
  return [];
}`,
  `export async function fetchSucursales() {
  if (MOCK_MODE_ENABLED) return getMockState().sucursales;

  const data = await apiJson(\`\${MASTERS_BASE}/sucursales\`);
  return (data || []).map(mapSucursal);
}`
);

apiCode = apiCode.replace(
  `export async function fetchPersonal() {
  if (MOCK_MODE_ENABLED) return getMockState().personal;

  console.warn("fetchPersonal: el backend no expone personal todavia.");
  return [];
}`,
  `export async function fetchPersonal() {
  if (MOCK_MODE_ENABLED) return getMockState().personal;

  const data = await apiJson(\`\${MASTERS_BASE}/trabajadores\`);
  return (data || []).map(mapTrabajador);
}`
);

fs.writeFileSync("src/features/deposits/api/depositsApi.js", apiCode);
console.log("Patched maps in depositsApi.js");

let modalCode = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

modalCode = modalCode.replace(
  `empresa_id: deposit.empresa?.id || deposit.empresa_id || "",
        banco_id: deposit.banco?.id || deposit.banco_id || "",`,
  `empresa_id: String(deposit.empresa?.id || deposit.empresa_id || "").toLowerCase(),
        banco_id: String(deposit.banco?.id || deposit.banco_id || "").toLowerCase(),`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", modalCode);
console.log("Patched fallback lowercase in DepositDetailModal.jsx");
