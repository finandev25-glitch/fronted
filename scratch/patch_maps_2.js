import fs from "fs";

let apiCode = fs.readFileSync("src/features/deposits/api/depositsApi.js", "utf-8");

apiCode = apiCode.replace(
  `empresa_id: item.empresaId || null,
      banco_id: item.bancoId || null,
      sucursal_id: item.sucursalId || null,
      validado_por: item.validadoPor || null,
      referencia_cliente: item.referenciaCliente || null,
      ruc_cliente: item.rucCliente || null,
      empresa: null,
      banco: null,
      sucursal: null,
      trabajador: null,`,
  `empresa_id: item.empresaId ? String(item.empresaId).toLowerCase() : null,
      banco_id: item.bancoId ? String(item.bancoId).toLowerCase() : null,
      sucursal_id: item.sucursalId ? String(item.sucursalId).toLowerCase() : null,
      validado_por: item.validadoPor || null,
      referencia_cliente: item.referenciaCliente || null,
      ruc_cliente: item.rucCliente || null,
      trabajador_id: item.trabajadorId || item.vendedorId ? String(item.trabajadorId || item.vendedorId).toLowerCase() : null,
      empresa: item.empresa ? mapEmpresa(item.empresa) : null,
      banco: item.banco ? mapBanco(item.banco) : null,
      sucursal: item.sucursal ? mapSucursal(item.sucursal) : null,
      trabajador: item.trabajador ? mapTrabajador(item.trabajador) : null,`
);

fs.writeFileSync("src/features/deposits/api/depositsApi.js", apiCode);
console.log("Patched mapDeposit mapping");
