import { buildApiUrl } from "../../../services/apiBase.js";
import { MOCK_MODE_ENABLED } from "../../../mocks/mockServer.js";
import { createInitialMockState } from "../../../mocks/mockData.js";

const API_BASE = "/api";
const DEPOSITS_BASE = "/v1/deposits";
const SESSION_KEY = "control-depositos-auth-session";

// Datos de prueba para el Kanban (VITE_USE_MOCK_DATA=true). El backend real
// solo trae "mis depositos" sin relaciones (empresa/banco/sucursal/trabajador
// vienen null), asi que para probar el diseño de las tarjetas con datos
// completos se usa este set fijo en vez de pegarle a la API.
let mockState = null;
function getMockState() {
  if (!mockState) {
    mockState = createInitialMockState();
  }
  return mockState;
}

function mapMockDeposit(deposit) {
  const state = getMockState();
  const empresa = state.empresas.find((item) => String(item.id) === String(deposit.empresa_id)) || null;
  const banco = state.bancos.find((item) => String(item.id) === String(deposit.banco_id)) || null;
  const sucursal = state.sucursales.find((item) => String(item.id) === String(deposit.sucursal_id)) || null;
  const trabajador = state.personal.find((item) => String(item.id) === String(deposit.trabajador_sucursal_id)) || null;
  const validadoPorUsuario = state.users.find((item) => String(item.id) === String(deposit.validado_por)) || null;

  return {
    ...deposit,
    empresa: empresa ? { id: empresa.id, nombre: empresa.nombre, abreviatura: empresa.abreviatura, estado: empresa.estado } : null,
    banco: banco ? { id: banco.id, abreviatura: banco.abreviatura, nombre: banco.nombre, estado: banco.estado } : null,
    sucursal: sucursal ? { id: sucursal.id, nombre: sucursal.nombre } : null,
    trabajador: trabajador ? { id: trabajador.id, nombre: trabajador.nombre, telefono_origen: trabajador.telefono_origen } : null,
    validado_por_usuario: validadoPorUsuario ? { id: validadoPorUsuario.id, nombre: validadoPorUsuario.nombre } : null,
  };
}

// Rango [desde, hasta] del mismo dia calendario (00:00:00.000 a 23:59:59.999),
// tomando la fecha "YYYY-MM-DD" tal cual, sin ajustar por zona horaria.
function dateToDayRange(dateStr) {
  return {
    desde: `${dateStr}T00:00:00.000Z`,
    hasta: `${dateStr}T23:59:59.999Z`,
  };
}

function getStoredAccessToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export async function apiJson(path, options = {}) {
  const accessToken = getStoredAccessToken();

  const response = await fetch(buildApiUrl(`${API_BASE}${path}`), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload?.error || payload?.message || response.statusText;
    throw new Error(message);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Catalogos. El backend real (Confirmo.Api) solo expone bancos y empresas.
// Sucursales, cuentas bancarias y personal no tienen endpoint todavia: se
// devuelven listas vacias para que la UI no se rompa mientras esos modulos
// no esten disponibles en el backend.
// ---------------------------------------------------------------------------

function mapBanco(banco) {
  return {
    id: banco.id,
    nombre: banco.nombre,
    abreviatura: banco.codigo || banco.nombre,
    estado: "activo",
  };
}

function mapEmpresa(empresa) {
  return {
    id: empresa.id,
    nombre: empresa.nombre,
    abreviatura: empresa.nombre,
    logo: empresa.logo || null,
    estado: "activo",
  };
}

export async function fetchBancos() {
  if (MOCK_MODE_ENABLED) return getMockState().bancos;

  const data = await apiJson(`${DEPOSITS_BASE}/bancos`);
  return (data || []).map(mapBanco);
}

export async function fetchEmpresas() {
  if (MOCK_MODE_ENABLED) return getMockState().empresas;

  const data = await apiJson(`${DEPOSITS_BASE}/empresas`);
  return (data || []).map(mapEmpresa);
}

export async function fetchCuentas() {
  if (MOCK_MODE_ENABLED) return getMockState().cuentas;

  console.warn("fetchCuentas: el backend no expone cuentas bancarias todavia.");
  return [];
}

export async function fetchSucursales() {
  if (MOCK_MODE_ENABLED) return getMockState().sucursales;

  console.warn("fetchSucursales: el backend no expone sucursales todavia.");
  return [];
}

export async function fetchPersonal() {
  if (MOCK_MODE_ENABLED) return getMockState().personal;

  console.warn("fetchPersonal: el backend no expone personal todavia.");
  return [];
}

export async function fetchDashboardBootstrap() {
  const [bancos, empresas, cuentas, sucursales, personal] = await Promise.all([
    fetchBancos(),
    fetchEmpresas(),
    fetchCuentas(),
    fetchSucursales(),
    fetchPersonal(),
  ]);

  return { bancos, empresas, cuentas, sucursales, personal };
}

// ---------------------------------------------------------------------------
// Depositos. El backend real solo lista los depositos del vendedor logueado
// (no existe una vista de "todos los depositos" para finanzas/admin todavia).
// ---------------------------------------------------------------------------

function mapDeposit(item) {
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
    // El backend expone imagenVoucher (ruta interna en storage) e imagenUrl
    // (URL firmada de lectura). La UI necesita una URL utilizable como src.
    imagen_voucher: item.imagenUrl || item.imagenVoucher || null,
    anexo: item.anexo || null,
    observaciones: item.observaciones || null,
    motivo_rechazo: item.motivoRechazo || null,
    fecha_validacion: item.fechaValidacion || null,
    empresa_id: item.empresaId || null,
    banco_id: item.bancoId || null,
    sucursal_id: item.sucursalId || null,
    validado_por: item.validadoPor || null,
    referencia_cliente: item.referenciaCliente || null,
    ruc_cliente: item.rucCliente || null,
    empresa: null,
    banco: null,
    sucursal: null,
    trabajador: null,
    validado_por_usuario: null,
  };
}

function fetchMockDepositsList({ desde, hasta } = {}) {
  const desdeMs = desde ? new Date(desde).getTime() : null;
  const hastaMs = hasta ? new Date(hasta).getTime() : null;

  return getMockState()
    .deposits.filter((deposit) => {
      const registradoMs = new Date(deposit.fecha_registro).getTime();
      if (desdeMs !== null && registradoMs < desdeMs) return false;
      if (hastaMs !== null && registradoMs > hastaMs) return false;
      return true;
    })
    .map(mapMockDeposit);
}

async function fetchDepositsList(params = {}) {
  if (MOCK_MODE_ENABLED) return fetchMockDepositsList(params);

  const query = new URLSearchParams();
  query.set("page", "1");
  query.set("pageSize", "600");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const data = await apiJson(`${DEPOSITS_BASE}?${query.toString()}`);
  return (data?.items || []).map(mapDeposit);
}

// UTC "ingenuo": construye el limite de dia (00:00:00 o 23:59:59) tomando la
// fecha calendario tal cual, sin ajustar por zona horaria. Se usa para rangos
// amplios (semana/mes) donde una diferencia de horas no cambia el resultado.
function naiveUtcDayStart(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)).toISOString();
}

function naiveUtcDayEnd(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)).toISOString();
}

export async function fetchDepositsByDate(date) {
  if (!date) return fetchDepositsList();

  const { desde, hasta } = dateToDayRange(date);
  return fetchDepositsList({ desde, hasta });
}

export async function fetchDepositsByPeriod(period) {
  const now = new Date();

  if (period === "today") {
    const today = now.toISOString().slice(0, 10);
    return fetchDepositsByDate(today);
  }

  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return fetchDepositsList({ desde: naiveUtcDayStart(start), hasta: naiveUtcDayEnd(now) });
  }

  if (typeof period === "string" && period.startsWith("month:")) {
    const [year, month] = period.slice("month:".length).split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return fetchDepositsList({ desde: naiveUtcDayStart(start), hasta: naiveUtcDayEnd(end) });
  }

  if (period === "month" || period === "mes") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return fetchDepositsList({ desde: naiveUtcDayStart(start), hasta: naiveUtcDayEnd(now) });
  }

  return fetchDepositsList();
}

export async function fetchAllDeposits() {
  return fetchDepositsList();
}

// El listado (GET /v1/deposits) solo trae campos resumidos para el Kanban.
// Al abrir el detalle de un deposito hay que pedir GET /v1/deposits/{id}
// para obtener imagenUrl, anexo, empresa/banco/sucursal, referenciaCliente, etc.
export async function fetchDepositById(id) {
  if (MOCK_MODE_ENABLED) {
    const deposit = getMockState().deposits.find((item) => String(item.id) === String(id));
    return deposit ? mapMockDeposit(deposit) : null;
  }

  const data = await apiJson(`${DEPOSITS_BASE}/${id}`);
  return mapDeposit(data);
}

// ---------------------------------------------------------------------------
// Catalogos: create/update/delete. Sin endpoints reales todavia para bancos,
// empresas, cuentas y personal (solo hay lectura); se dejan como no-op que
// avisan en consola en vez de romper la UI.
// ---------------------------------------------------------------------------

async function unsupportedWrite(action) {
  console.warn(`${action}: el backend no soporta esta operacion todavia.`);
  throw new Error("Esta operacion no esta disponible todavia en el backend.");
}

export async function createBanco() {
  return unsupportedWrite("createBanco");
}

export async function updateBanco() {
  return unsupportedWrite("updateBanco");
}

export async function deleteBanco() {
  return unsupportedWrite("deleteBanco");
}

export async function createEmpresa() {
  return unsupportedWrite("createEmpresa");
}

export async function updateEmpresa() {
  return unsupportedWrite("updateEmpresa");
}

export async function createCuenta() {
  return unsupportedWrite("createCuenta");
}

export async function updateCuenta() {
  return unsupportedWrite("updateCuenta");
}

export async function deleteCuenta() {
  return unsupportedWrite("deleteCuenta");
}

export async function createSucursal() {
  return unsupportedWrite("createSucursal");
}

export async function updateSucursal() {
  return unsupportedWrite("updateSucursal");
}

export async function createPersonal() {
  return unsupportedWrite("createPersonal");
}

export async function updatePersonal() {
  return unsupportedWrite("updatePersonal");
}

export async function deletePersonal() {
  return unsupportedWrite("deletePersonal");
}

// ---------------------------------------------------------------------------
// Actualizacion de depositos: el backend real no tiene un PUT generico, solo
// transiciones de estado especificas (confirmar / regularizar). Mapeamos el
// caso mas comun (confirmar) y avisamos para el resto.
// ---------------------------------------------------------------------------

export async function confirmDeposit(id, observaciones) {
  const data = await apiJson(`${DEPOSITS_BASE}/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(observaciones ? { observaciones } : {}),
  });
  return data;
}

export async function updateDeposit(id, payload) {
  if (payload?.estado === "confirmado") {
    return confirmDeposit(id, payload.observaciones);
  }

  console.warn(
    "updateDeposit: el backend no soporta edicion generica de depositos todavia (solo confirmar/regularizar)."
  );
  throw new Error("Esta actualizacion no esta disponible todavia en el backend.");
}

export async function createSupportRequest() {
  return unsupportedWrite("createSupportRequest");
}
