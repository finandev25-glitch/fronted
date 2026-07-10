import fs from "fs";

let apiCode = fs.readFileSync("src/features/deposits/api/depositsApi.js", "utf-8");

// Re-apply API endpoints and fetchCuentas
apiCode = apiCode.replace(
  `const DEPOSITS_BASE = "/v1/deposits";`,
  `const DEPOSITS_BASE = "/v1/deposits";\nconst MASTERS_BASE = "/v1/masters";`
);

apiCode = apiCode.replace(
  /export async function fetchCuentas\(\) \{[\s\S]*?return \[\];\s*\}/,
  `export async function fetchCuentas(empresaId, bancoId) {
  if (MOCK_MODE_ENABLED) return getMockState().cuentas;

  let url = \`\${MASTERS_BASE}/cuentasbancarias\`;
  const params = new URLSearchParams();
  if (empresaId) params.append("empresaId", empresaId);
  if (bancoId) params.append("bancoId", bancoId);
  if (params.toString()) url += \`?\${params.toString()}\`;

  const data = await apiJson(url);
  return data || [];
}`
);

// Append new endpoints
if (!apiCode.includes("checkDuplicate")) {
  apiCode += `
export async function lockDeposit(id) {
  return apiJson(\`\${DEPOSITS_BASE}/\${id}/lock\`, { method: "POST" });
}

export async function unlockDeposit(id) {
  return apiJson(\`\${DEPOSITS_BASE}/\${id}/unlock\`, { method: "POST" });
}

export async function checkDuplicate(payload) {
  if (MOCK_MODE_ENABLED) return { duplicates: [] };
  return apiJson(\`\${DEPOSITS_BASE}/check-duplicate\`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
`;
}

// Fix masters base for bancos, empresas, sucursales, personal
apiCode = apiCode.replace(
  "const data = await apiJson(`${DEPOSITS_BASE}/bancos`);",
  "const data = await apiJson(`${MASTERS_BASE}/bancos`);"
);
apiCode = apiCode.replace(
  "const data = await apiJson(`${DEPOSITS_BASE}/empresas`);",
  "const data = await apiJson(`${MASTERS_BASE}/empresas`);"
);

// Rewrite map functions completely
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

// Fix fetchSucursales and fetchPersonal
apiCode = apiCode.replace(
  /export async function fetchSucursales\(\) \{[\s\S]*?return \[\];\s*\}/,
  `export async function fetchSucursales() {
  if (MOCK_MODE_ENABLED) return getMockState().sucursales;
  const data = await apiJson(\`\${MASTERS_BASE}/sucursales\`);
  return (data || []).map(mapSucursal);
}`
);

apiCode = apiCode.replace(
  /export async function fetchPersonal\(\) \{[\s\S]*?return \[\];\s*\}/,
  `export async function fetchPersonal() {
  if (MOCK_MODE_ENABLED) return getMockState().personal;
  const data = await apiJson(\`\${MASTERS_BASE}/trabajadores\`);
  return (data || []).map(mapTrabajador);
}`
);

// Rewrite mapDeposit safely using regex to replace the entire body
apiCode = apiCode.replace(
  /function mapDeposit\(item\) \{[\s\S]*?return \{([\s\S]*?)\};\s*\}/,
  `function mapDeposit(item) {
    return {
      id: item.id,
      numero_operacion: item.numeroOperacion,
      cliente: item.cliente,
      monto: item.monto,
      moneda: item.moneda,
      fecha_registro: item.fechaRegistro,
      fecha_solo_date: item.fechaRegistro ? item.fechaRegistro.slice(0, 10) : null,
      estado: item.estado,
      numero_operacion_banco: item.numeroOperacionBanco,
      fecha_deposito: item.fechaDeposito,
      imagen_voucher: item.imagenUrl || item.imagenVoucher || null,
      anexo: item.anexo || null,
      observaciones: item.observaciones || null,
      motivo_rechazo: item.motivoRechazo || null,
      fecha_validacion: item.fechaValidacion || null,
      empresa_id: item.empresaId ? String(item.empresaId).toLowerCase() : null,
      banco_id: item.bancoId ? String(item.bancoId).toLowerCase() : null,
      sucursal_id: item.sucursalId ? String(item.sucursalId).toLowerCase() : null,
      validado_por: item.validadoPor || null,
      referencia_cliente: item.referenciaCliente || null,
      ruc_cliente: item.rucCliente || null,
      trabajador_id: (item.trabajadorId || item.vendedorId) ? String(item.trabajadorId || item.vendedorId).toLowerCase() : null,
      empresa: item.empresa ? mapEmpresa(item.empresa) : null,
      banco: item.banco ? mapBanco(item.banco) : null,
      sucursal: item.sucursal ? mapSucursal(item.sucursal) : null,
      trabajador: item.trabajador ? mapTrabajador(item.trabajador) : null,
      validado_por_usuario: item.validadoPorUsuario || null,
    };
  }`
);

fs.writeFileSync("src/features/deposits/api/depositsApi.js", apiCode);
console.log("Fully restored and patched depositsApi.js");
