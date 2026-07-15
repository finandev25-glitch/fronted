import { buildApiUrl } from "../../../services/apiBase.js";
import { MOCK_MODE_ENABLED } from "../../../mocks/mockServer.js";
import { createInitialMockState } from "../../../mocks/mockData.js";

const API_BASE = "/api";
const DEPOSITS_BASE = "/v1/deposits";
const MASTERS_BASE = "/v1/masters";
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
    empresa: empresa ? { id: empresa.id, nombre: empresa.nombre, estado: empresa.estado } : null,
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
// Catalogos. El backend real (Confirmo.Api) expone CRUD completo para
// bancos, empresas, sucursales, cuentasbancarias y trabajadores bajo
// /api/v1/masters/* (ver Confirmo.Api/Endpoints/MasterEndpoints.cs).
// ---------------------------------------------------------------------------

function mapBanco(banco) {
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
    profile_id: String(trabajador.profileId || trabajador.ProfileId || "").toLowerCase(),
    empresa_id: String(trabajador.empresaId || trabajador.EmpresaId || "").toLowerCase(),
    sucursal_id: String(trabajador.sucursalId || trabajador.SucursalId || "").toLowerCase(),
    nombre: trabajador.nombre || trabajador.Nombre || "",
    telefono_origen: trabajador.telefonoPersonal || trabajador.TelefonoPersonal || "",
    estado: (trabajador.activo ?? trabajador.Activo) ? "activo" : "inactivo",
  };
}

// ProfileResponse (backend) = una cuenta de login (telefono/email + password +
// rol admin/finanzas/vendedor), distinta de Trabajador (registro de personal
// asignado a una sucursal). Un Trabajador siempre apunta a un Profile ya
// existente via ProfileId. Ver mapProfile/fetchProfiles/createProfile abajo.
function mapProfile(profile) {
  if (!profile) return null;
  return {
    id: String(profile.id || profile.Id || "").toLowerCase(),
    phoneNumber: profile.phoneNumber || profile.PhoneNumber || null,
    email: profile.email || profile.Email || null,
    nombre: profile.fullName || profile.FullName || "",
    empresa_id: String(profile.empresaId || profile.EmpresaId || "").toLowerCase(),
    sucursal_id: (profile.sucursalId || profile.SucursalId)
      ? String(profile.sucursalId || profile.SucursalId).toLowerCase()
      : null,
    rol: profile.rol || profile.Rol || "",
    estado: (profile.activo ?? profile.Activo) ? "activo" : "inactivo",
    createdAt: profile.createdAt || profile.CreatedAt || null,
    lastLoginAt: profile.lastLoginAt || profile.LastLoginAt || null,
  };
}

// CuentaBancariaResponse trae solo ids planos (EmpresaId/BancoId), sin objetos
// anidados de empresa/banco. Los componentes que muestran nombre/abreviatura
// (BancosView) resuelven esos ids contra las listas de empresas/bancos que ya
// tienen cargadas, en vez de esperar objetos anidados aca.
function mapCuenta(cuenta) {
  if (!cuenta) return null;
  return {
    id: String(cuenta.id || cuenta.Id || "").toLowerCase(),
    empresa_id: String(cuenta.empresaId || cuenta.EmpresaId || "").toLowerCase(),
    banco_id: String(cuenta.bancoId || cuenta.BancoId || "").toLowerCase(),
    nro_cuenta: cuenta.numeroCuenta || cuenta.NumeroCuenta || "",
    anexo: cuenta.anexo || cuenta.Anexo || "",
    estado: (cuenta.activo ?? cuenta.Activo) ? "activo" : "inactivo",
  };
}

export async function fetchBancos() {
  if (MOCK_MODE_ENABLED) return getMockState().bancos;

  const data = await apiJson(`${MASTERS_BASE}/bancos`);
  return (data || []).map(mapBanco);
}

export async function fetchEmpresas() {
  if (MOCK_MODE_ENABLED) return getMockState().empresas;

  const data = await apiJson(`${MASTERS_BASE}/empresas`);
  return (data || []).map(mapEmpresa);
}

export async function fetchCuentas(empresaId, bancoId) {
  if (MOCK_MODE_ENABLED) return getMockState().cuentas;

  let url = `${MASTERS_BASE}/cuentasbancarias`;
  const params = new URLSearchParams();
  if (empresaId) params.append("empresaId", empresaId);
  if (bancoId) params.append("bancoId", bancoId);
  if (params.toString()) url += `?${params.toString()}`;

  const data = await apiJson(url);
  return (data || []).map(mapCuenta);
}

export async function fetchSucursales() {
  if (MOCK_MODE_ENABLED) return getMockState().sucursales;
  const data = await apiJson(`${MASTERS_BASE}/sucursales`);
  return (data || []).map(mapSucursal);
}

export async function fetchPersonal() {
  if (MOCK_MODE_ENABLED) return getMockState().personal;
  const data = await apiJson(`${MASTERS_BASE}/trabajadores`);
  return (data || []).map(mapTrabajador);
}

// GET /v1/masters/profiles requiere rol admin/finanzas (IsAdminOrFinanzas).
// Se usa para el selector de "usuario existente" en AddPersonModal. filtros
// admite empresaId/sucursalId/rol/activo, todos opcionales (mismos query
// params que soporta el backend).
export async function fetchProfiles(filtros = {}) {
  if (MOCK_MODE_ENABLED) return getMockState().users;

  const params = new URLSearchParams();
  if (filtros.empresaId) params.append("empresaId", filtros.empresaId);
  if (filtros.sucursalId) params.append("sucursalId", filtros.sucursalId);
  if (filtros.rol) params.append("rol", filtros.rol);
  if (filtros.activo !== undefined && filtros.activo !== null) {
    params.append("activo", String(filtros.activo));
  }

  let url = `${MASTERS_BASE}/profiles`;
  if (params.toString()) url += `?${params.toString()}`;

  const data = await apiJson(url);
  return (data || []).map(mapProfile);
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

// Antes se guardaba/usaba item.imagenUrl (URL firmada de GCS, vive solo 20
// minutos) tal cual venia del backend. Cualquier tabla/tarjeta que la tuviera
// abierta mas de esos 20 minutos, o que la releyera de una fila cacheada,
// terminaba con un link roto. En vez de eso, armamos SIEMPRE la misma URL
// estable hacia el endpoint "redirect" del backend (GET
// /v1/deposits/{id}/image): el backend firma una URL fresca en cada visita,
// asi que esta URL nunca expira del lado del cliente.
function buildVoucherImageUrl(depositId) {
  if (!depositId) return null;
  const token = getStoredAccessToken();
  if (!token) return null;
  return buildApiUrl(
    `${API_BASE}${DEPOSITS_BASE}/${depositId}/image?access_token=${encodeURIComponent(token)}`
  );
}

function mapDeposit(item) {
    const hasVoucher = Boolean(item.imagenUrl || item.imagenVoucher);
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
      imagen_voucher: hasVoucher ? buildVoucherImageUrl(item.id) : null,
      anexo: item.anexo || null,
      observaciones: item.observaciones || null,
      motivo_rechazo: item.motivoRechazo || null,
      fecha_validacion: item.fechaValidacion || null,
      condicion: item.condicion || null,
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
      // Marcado por finanzas/admin desde el listado (independiente del
      // Estado) para indicar que el voucher esta incompleto y hay que
      // subirle una imagen nueva. Ver markDepositForRegularize/
      // financeRegularizeImage mas abajo.
      //
      // OJO: el backend solo manda "pendienteRegularizar" en la respuesta
      // del LISTADO (GET /v1/deposits), no en la del detalle individual
      // (GET /v1/deposits/{id}). El Kanban pide ese detalle individual
      // aparte y lo fusiona sobre el depósito que ya tenía cargado
      // ({...prev, ...fullDeposit} en KanbanPage). Si aquí siempre
      // pusiéramos `Boolean(item.pendienteRegularizar)`, esa fusión
      // pisaría el flag correcto (true, venido del listado) con `false`
      // apenas llegara el detalle. Por eso solo se incluye la clave cuando
      // el campo realmente vino en la respuesta -- así el spread del
      // detalle no tiene con qué sobreescribirlo.
      ...(item.pendienteRegularizar !== undefined
        ? { pendiente_regularizar: Boolean(item.pendienteRegularizar) }
        : {}),
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
// Catalogos: create/update/delete contra /api/v1/masters/*. Los verbos de
// escritura (POST/PUT/DELETE) requieren rol admin en el backend (IsAdmin);
// si el usuario logueado no es admin, el backend responde 403 y apiJson lo
// convierte en Error con el mensaje del backend.
//
// IMPORTANTE (PUT = reemplazo completo): los endpoints PUT de masters no
// aceptan updates parciales, exigen el objeto completo (Nombre/Activo/etc).
// Por eso los handlers de los hooks (useDepositCatalogs.js) mezclan el
// registro existente con los cambios parciales antes de llamar a estas
// funciones (mismo patron que ya usaba AuthContext.updateUserProfile para
// /v1/masters/profiles/{id}).
// ---------------------------------------------------------------------------

export async function createBanco(data) {
  const body = {
    nombre: (data?.nombre || "").trim(),
    codigo: data?.abreviatura || data?.codigo || null,
  };
  const created = await apiJson(`${MASTERS_BASE}/bancos`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapBanco(created);
}

export async function updateBanco(id, data) {
  const body = {
    nombre: (data?.nombre || "").trim(),
    codigo: data?.abreviatura || data?.codigo || null,
    activo: data?.estado ? data.estado === "activo" : true,
  };
  const updated = await apiJson(`${MASTERS_BASE}/bancos/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return mapBanco(updated);
}

export async function deleteBanco(id) {
  // Soft delete: el backend marca Activo=false, no borra la fila.
  return apiJson(`${MASTERS_BASE}/bancos/${id}`, { method: "DELETE" });
}

// NOTA: EmpresaResponse/CreateEmpresaRequest/UpdateEmpresaRequest (backend)
// solo tienen Nombre, Ruc, Logo y Activo — no existe un campo "Abreviatura".
// El campo fue eliminado del formulario/listado de Empresa en el frontend
// (era decorativo, nunca se persistio).
export async function createEmpresa(data) {
  const body = {
    nombre: (data?.nombre || "").trim(),
    ruc: data?.ruc || null,
    logo: data?.logo || null,
  };
  const created = await apiJson(`${MASTERS_BASE}/empresas`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapEmpresa(created);
}

export async function updateEmpresa(id, data) {
  const body = {
    nombre: (data?.nombre || "").trim(),
    ruc: data?.ruc || null,
    logo: data?.logo || null,
    activo: data?.estado ? data.estado === "activo" : true,
  };
  const updated = await apiJson(`${MASTERS_BASE}/empresas/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return mapEmpresa(updated);
}

export async function createCuenta(data) {
  const body = {
    numeroCuenta: (data?.nro_cuenta || "").trim(),
    anexo: data?.anexo || "",
    empresaId: data?.empresa_id || data?.empresaId,
    bancoId: data?.banco_id || data?.bancoId,
  };
  const created = await apiJson(`${MASTERS_BASE}/cuentasbancarias`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapCuenta(created);
}

export async function updateCuenta(id, data) {
  const body = {
    numeroCuenta: (data?.nro_cuenta || "").trim(),
    anexo: data?.anexo || "",
    empresaId: data?.empresa_id || data?.empresaId,
    bancoId: data?.banco_id || data?.bancoId,
    activo: data?.estado ? data.estado === "activo" : true,
  };
  const updated = await apiJson(`${MASTERS_BASE}/cuentasbancarias/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return mapCuenta(updated);
}

export async function deleteCuenta(id) {
  return apiJson(`${MASTERS_BASE}/cuentasbancarias/${id}`, { method: "DELETE" });
}

export async function createSucursal(data) {
  const body = {
    empresaId: data?.empresa_id || data?.empresaId,
    nombre: (data?.nombre || "").trim(),
    direccion: data?.direccion || null,
  };
  const created = await apiJson(`${MASTERS_BASE}/sucursales`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapSucursal(created);
}

export async function updateSucursal(id, data) {
  const body = {
    empresaId: data?.empresa_id || data?.empresaId,
    nombre: (data?.nombre || "").trim(),
    direccion: data?.direccion || null,
    activo: data?.estado ? data.estado === "activo" : true,
  };
  const updated = await apiJson(`${MASTERS_BASE}/sucursales/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return mapSucursal(updated);
}

// NOTA IMPORTANTE (Trabajador <-> Profile): CreateTrabajadorRequest exige un
// ProfileId (Guid) de un Profile YA EXISTENTE (backend valida con
// context.Profiles.AnyAsync). Un Profile es una cuenta de login del sistema
// (telefono/email + password + rol), no simplemente "un contacto".
// AddPersonModal ofrece dos caminos para conseguir ese profileId: elegir un
// Profile ya existente (fetchProfiles) o crear uno nuevo ahi mismo
// (createProfile) y usar el id resultante. Esta funcion sigue exigiendo
// explicitamente un profileId en el payload; si no llega, falla con un
// mensaje claro en vez de mandar un profileId inventado.
export async function createPersonal(data) {
  if (!data?.profileId && !data?.profile_id) {
    console.warn(
      "createPersonal: falta profileId. POST /v1/masters/trabajadores exige un Profile " +
        "existente; AddPersonModal todavia no lo captura."
    );
    throw new Error(
      "No se puede crear el trabajador: falta un usuario (Profile) existente para asociarlo. " +
        "Esta parte del formulario todavia no esta conectada."
    );
  }

  const body = {
    profileId: data.profileId || data.profile_id,
    nombre: (data.nombre || "").trim(),
    telefonoPersonal: data.telefono || data.telefono_origen || null,
    empresaId: data.empresa_id || data.empresaId,
    sucursalId: data.sucursal_id || data.sucursalId || null,
    fechaInicio: data.fechaInicio || new Date().toISOString().slice(0, 10),
  };

  const created = await apiJson(`${MASTERS_BASE}/trabajadores`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapTrabajador(created);
}

// POST /v1/masters/profiles requiere rol admin (IsAdmin). CreateProfileRequest
// exige Password + FullName + EmpresaId siempre, y ademas PhoneNumber o Email
// (al menos uno de los dos; el backend valida unicidad de cada uno si vienen).
// Se usa desde AddPersonModal cuando se elige "Crear nuevo usuario": primero
// se llama a esta funcion, y con el id devuelto se llama a createPersonal.
export async function createProfile(data) {
  const body = {
    phoneNumber: data?.phoneNumber || data?.telefono || null,
    email: data?.email || null,
    password: data?.password || "",
    fullName: (data?.nombre || data?.fullName || "").trim(),
    empresaId: data?.empresa_id || data?.empresaId,
    sucursalId: data?.sucursal_id || data?.sucursalId || null,
    rol: data?.rol || "vendedor",
  };

  const created = await apiJson(`${MASTERS_BASE}/profiles`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapProfile(created);
}

export async function updatePersonal(id, data) {
  const body = {
    nombre: (data.nombre || "").trim(),
    telefonoPersonal: data.telefono || data.telefono_origen || null,
    sucursalId: data.sucursal_id || data.sucursalId || null,
    activo: data.estado ? data.estado === "activo" : true,
  };
  const updated = await apiJson(`${MASTERS_BASE}/trabajadores/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return mapTrabajador(updated);
}

export async function deletePersonal(id) {
  return apiJson(`${MASTERS_BASE}/trabajadores/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Actualizacion de depositos: el backend real no tiene un PUT generico, solo
// transiciones de estado especificas (confirmar / regularizar). Mapeamos el
// caso mas comun (confirmar) y avisamos para el resto.
// ---------------------------------------------------------------------------

// El backend espera el ANEXO como texto libre (columna Deposito.Anexo, string),
// no como un id de cuentasbancarias — por eso aqui se manda tal cual viene de
// editableData.anexo (que ya es el valor de texto del anexo seleccionado).
export async function confirmDeposit(id, { observaciones, anexo } = {}) {
  const body = {};
  if (observaciones) body.observaciones = observaciones;
  if (anexo) body.anexo = anexo;

  const data = await apiJson(`${DEPOSITS_BASE}/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data;
}

// POST /v1/deposits/{id}/reject — "observaciones" es obligatorio para el
// backend (RejectDepositRequest.Observaciones no es nullable); "anexo" es
// opcional, igual que en confirm.
export async function rejectDeposit(id, { observaciones, anexo } = {}) {
  const body = { observaciones: observaciones || "" };
  if (anexo) body.anexo = anexo;

  const data = await apiJson(`${DEPOSITS_BASE}/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data;
}

// POST /v1/deposits/{id}/mark-regularize — Solo finanzas/admin (el backend
// valida el rol). A diferencia de regularizeDeposit (flujo del vendedor,
// exige Estado="rechazado" y SI vuelve a encolar al worker de IA), este
// marca el deposito para regularizar sin importar su Estado actual. Es solo
// el primer paso: marca el flag `pendienteRegularizar`, el archivo se sube
// despues con financeRegularizeImage. Sin motivo: no se pide/envia desde el
// fronted.
export async function markDepositForRegularize(id) {
  return apiJson(`${DEPOSITS_BASE}/${id}/mark-regularize`, { method: "POST" });
}

// POST /v1/deposits/{id}/unmark-regularize — por si se marco por error.
export async function unmarkDepositForRegularize(id) {
  return apiJson(`${DEPOSITS_BASE}/${id}/unmark-regularize`, { method: "POST" });
}

// PUT /v1/deposits/{id}/finance-regularize-image — reemplaza UNICAMENTE el
// archivo del voucher (imagenBase64 sin el prefijo "data:...;base64,").
// El backend exige que el deposito ya este marcado (mark-regularize) y, a
// diferencia de regularizeDeposit, NO cambia Estado ni encola nada para el
// python-worker: es un reemplazo directo, no un reproceso.
export async function financeRegularizeImage(id, imagenBase64) {
  return apiJson(`${DEPOSITS_BASE}/${id}/finance-regularize-image`, {
    method: "PUT",
    body: JSON.stringify({ imagenBase64 }),
  });
}

export async function updateDeposit(id, payload) {
  if (payload?.estado === "confirmado") {
    return confirmDeposit(id, { observaciones: payload.observaciones, anexo: payload.anexo });
  }

  console.warn(
    "updateDeposit: el backend no soporta edicion generica de depositos todavia (solo confirmar/regularizar)."
  );
  throw new Error("Esta actualizacion no esta disponible todavia en el backend.");
}

export async function createSupportRequest() {
  console.warn("createSupportRequest: el backend no soporta esta operacion todavia.");
  throw new Error("Esta operacion no esta disponible todavia en el backend.");
}

export async function lockDeposit(id) {
  return apiJson(`${DEPOSITS_BASE}/${id}/lock`, { method: "POST" });
}

export async function unlockDeposit(id) {
  return apiJson(`${DEPOSITS_BASE}/${id}/unlock`, { method: "POST" });
}

export async function checkDuplicate(payload) {
  if (MOCK_MODE_ENABLED) return { duplicates: [] };
  return apiJson(`${DEPOSITS_BASE}/check-duplicate`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
