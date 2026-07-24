/**
 * depositQueueCatalogHelpers.js
 *
 * Catálogos que se mandan a la cola de la extensión (ver useDepositQueue.js)
 * para que el side panel pueda mostrar los mismos <select> de Banco/Anexo
 * que el detalle real, sin que la extensión tenga que hacer su propio
 * llamado autenticado al backend (no tiene sesión propia). Usado tanto por
 * useDepositQueue.js (botón "Agregar a cola" del Kanban) como por
 * DepositDetailModal.jsx (botón "Panel Lateral"), para que ambos caminos
 * manden exactamente los mismos datos.
 *
 * En vez de precalcular un mapa {bancoId: [anexos]} del lado de la app (que
 * dependía de tener bien resuelto cada bancoId de antemano y era más difícil
 * de depurar), se manda directo la tabla maestra de cuentas bancarias
 * (filtrada solo a la empresa del depósito) y es el propio side panel el que
 * la consulta/filtra en el momento, cada vez que el usuario cambia de Banco
 * (ver sidepanel.js, buildAnexoOptionsFromCuentas).
 */

export function getBancoOptions(bancos) {
  return (Array.isArray(bancos) ? bancos : [])
    .filter((b) => b.estado === "activo")
    .map((b) => ({ id: b.id, nombre: b.abreviatura || b.nombre }));
}

export function getAnexoOptionsForDeposit(deposit, cuentas) {
  const empresaId = String(deposit?.empresa?.id || deposit?.empresa_id || "").toLowerCase();
  const bancoId = String(deposit?.banco?.id || deposit?.banco_id || "").toLowerCase();
  if (!empresaId || !bancoId || !Array.isArray(cuentas)) return [];

  return [
    ...new Set(
      cuentas
        .filter(
          (c) =>
            String(c?.empresa_id || "").toLowerCase() === empresaId &&
            String(c?.banco_id || "").toLowerCase() === bancoId &&
            c?.estado !== "inactivo",
        )
        .map((c) => c.anexo)
        .filter(Boolean),
    ),
  ];
}

// Tabla de cuentas bancarias (anexos) de la empresa del depósito, en un
// formato mínimo -- se manda entera para que el side panel pueda filtrarla
// él mismo por banco cada vez que el usuario cambia el <select> de Banco.
export function getCuentasBancariasForEmpresa(deposit, cuentas) {
  const empresaId = String(deposit?.empresa?.id || deposit?.empresa_id || "").toLowerCase();
  if (!empresaId || !Array.isArray(cuentas)) return [];

  return cuentas
    .filter(
      (c) => String(c?.empresa_id || "").toLowerCase() === empresaId && c?.estado !== "inactivo",
    )
    .map((c) => ({ bancoId: c.banco_id, anexo: c.anexo }))
    .filter((c) => c.bancoId && c.anexo);
}

export default {
  getBancoOptions,
  getAnexoOptionsForDeposit,
  getCuentasBancariasForEmpresa,
};
