import { buildApiUrl } from "../../../services/apiBase.js";
import { apiBlob } from "../../../services/backendApi.js";
import { MOCK_MODE_ENABLED } from "../../../mocks/mockServer.js";
import { createInitialMockState } from "../../../mocks/mockData.js";
import { toLocalISOString } from "../../../utils/dateFormatters.js";

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

// Offset real de America/Lima respecto a UTC, en minutos (Lima no observa
// horario de verano, asi que en la practica esto siempre da -300 = UTC-5 --
// se calcula con Intl en vez de hardcodear el numero, para no depender de un
// magic number si algo cambiara).
function getLimaUtcOffsetMinutes(referenceDate = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(referenceDate)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - referenceDate.getTime()) / 60000);
}

// Convierte una fecha/hora "de pared" en huso de Lima (YYYY-MM-DD + h:m:s) al
// instante UTC real que le corresponde.
//
// FIX: antes dateToDayRange armaba `${dateStr}T00:00:00.000Z` directo,
// tratando la fecha de Lima como si esas horas YA fueran UTC. Como Lima es
// UTC-5, la medianoche real de Lima cae a las 05:00 UTC -- la ventana de
// "hoy" quedaba corrida ~5 horas antes de lo real. Un deposito hecho a las
// 9pm en Lima (2am UTC del dia siguiente) quedaba FUERA del "hoy" que
// consultaba el Kanban, y solo aparecia si se consultaba el dia siguiente.
function limaWallTimeToUtcISO(dateStr, hour, minute, second, ms) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const offsetMinutes = getLimaUtcOffsetMinutes();
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMinutes * 60000;
  return new Date(utcMs).toISOString();
}

// Rango [desde, hasta] del mismo dia calendario EN HUSO DE LIMA (00:00:00.000
// a 23:59:59.999 hora Lima), convertido a instantes UTC reales.
function dateToDayRange(dateStr) {
  return {
    desde: limaWallTimeToUtcISO(dateStr, 0, 0, 0, 0),
    hasta: limaWallTimeToUtcISO(dateStr, 23, 59, 59, 999),
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

function normalizeDatosOcr(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("DatosOcr no contiene JSON válido:", error);
      return null;
    }
  }

  return null;
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
      // FIX: antes era item.fechaRegistro.slice(0, 10) -- cortaba el string
      // UTC crudo, así que un depósito hecho entre ~19:00 y 23:59 hora Lima
      // (que en UTC ya cayó en el día siguiente) quedaba con la fecha de
      // MAÑANA acá, y todos los filtros por día que comparan contra esto
      // (Kanban, Tabla, tarjetas) lo escondían del día en que realmente se
      // recibió. toLocalISOString ya convierte a huso America/Lima.
      fecha_solo_date: item.fechaRegistro ? toLocalISOString(item.fechaRegistro) : null,
      // Fecha ORIGINAL de registro, inmutable -- a diferencia de fecha_registro,
      // esta nunca se pisa (ni siquiera al "traer rezagados a hoy"). Sirve como
      // respaldo/auditoría cuando se necesita defender la hora real en que el
      // vendedor subió el depósito. Puede venir null en depósitos creados antes
      // de este cambio si no se hizo backfill.
      fecha_registro_original: item.fechaRegistroOriginal || null,
      estado: item.estado,
      numero_operacion_banco: item.numeroOperacionBanco,
      fecha_deposito: item.fechaDeposito,
      datos_ocr: normalizeDatosOcr(
        item.datosOcr ?? item.DatosOcr ?? item.datos_ocr,
      ),
      imagen_voucher: hasVoucher ? buildVoucherImageUrl(item.id) : null,
      // OJO: "imagenUrl" significa cosas distintas segun el endpoint que
      // responda. En el LISTADO (GET /v1/deposits, de donde sale esto) es la
      // URL directa a Google Drive que se guardo para depositos antiguos
      // (columna nueva Deposito.ImagenUrl -- backend ya la expone). En el
      // DETALLE individual (GET /v1/deposits/{id}) el mismo campo JSON es
      // en cambio la URL firmada de GCS (vive 20 min), un valor totalmente
      // distinto que ya se usaba arriba solo para el check hasVoucher. Por
      // eso esto se guarda aparte, con nombre propio, y NO se mezcla con
      // imagen_voucher -- ver TablePage.jsx (handleExportExcel), que es el
      // unico lugar que lo usa hoy (solo para el Excel, no la tabla visible).
      imagen_url_legacy: item.imagenUrl || null,
      anexo: item.anexo || null,
      observaciones: item.observaciones || null,
      motivo_rechazo: item.motivoRechazo || null,
      fecha_validacion: item.fechaValidacion || null,
      // Marca cuándo se tomó el candado actual (POST /lock) -- distinto de
      // fecha_validacion, que también se pisa al confirmar. Se usa para el
      // temporizador de 4 min (ver utils/depositLockHelpers.js).
      fecha_bloqueo: item.fechaBloqueo || null,
      condicion: item.condicion || null,
      riesgo: item.riesgo ?? false,
      empresa_id: item.empresaId ? String(item.empresaId).toLowerCase() : null,
      banco_id: item.bancoId ? String(item.bancoId).toLowerCase() : null,
      sucursal_id: item.sucursalId ? String(item.sucursalId).toLowerCase() : null,
      validado_por: item.validadoPor || null,
      referencia_cliente: item.referenciaCliente || null,
      ruc_cliente: item.rucCliente || null,
      numero_tarjeta: item.numeroTarjeta || null,
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

// Un mes puede traer ~6000 depositos; se pide todo en UNA sola consulta
// (el backend no tiene tope de pageSize) y la paginacion se hace en el
// cliente (TablePage) para no pintar miles de filas en el DOM.
const LIST_PAGE_SIZE = 10000;

async function fetchDepositsList(params = {}) {
  if (MOCK_MODE_ENABLED) return fetchMockDepositsList(params);

  const query = new URLSearchParams();
  query.set("page", "1");
  query.set("pageSize", String(LIST_PAGE_SIZE));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const data = await apiJson(`${DEPOSITS_BASE}?${query.toString()}`);
  const items = data?.items || [];
  if (typeof data?.total === "number" && data.total > items.length) {
    console.warn(
      `Listado de depositos truncado: mostrando ${items.length} de ${data.total} registros.`
    );
  }
  return items.map(mapDeposit);
}

// FIX: reemplaza a las viejas naiveUtcDayStart/naiveUtcDayEnd, que tomaban
// date.getFullYear()/getMonth()/getDate() (huso del NAVEGADOR, no
// necesariamente Lima) y ademas armaban el limite como si esas horas ya
// fueran UTC -- mismo bug que dateToDayRange, aplicado a los rangos de
// semana/mes. Estas reciben directamente un string "YYYY-MM-DD" en huso
// Lima y usan limaWallTimeToUtcISO para la conversion real.
function limaDayRangeStart(dateStr) {
  return limaWallTimeToUtcISO(dateStr, 0, 0, 0, 0);
}

function limaDayRangeEnd(dateStr) {
  return limaWallTimeToUtcISO(dateStr, 23, 59, 59, 999);
}

// Suma/resta dias a un string "YYYY-MM-DD" por aritmetica de calendario pura
// (sin pasar por horas locales, para no arrastrar el huso del navegador).
function addDaysToDateStr(dateStr, dias) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

export async function fetchDepositsByDate(date) {
  if (!date) return fetchDepositsList();

  const { desde, hasta } = dateToDayRange(date);
  return fetchDepositsList({ desde, hasta });
}

// Rango arbitrario [desdeDate, hastaDate] (ambos "YYYY-MM-DD", inclusive) --
// usado por VouchersPreviewPage para extender la busqueda mas alla de un
// solo dia. El tope de 6 dias se valida del lado del componente, no aca.
export async function fetchDepositsByRange(desdeDate, hastaDate) {
  if (!desdeDate) return fetchDepositsList();

  const { desde } = dateToDayRange(desdeDate);
  const { hasta } = dateToDayRange(hastaDate || desdeDate);
  return fetchDepositsList({ desde, hasta });
}

export async function fetchDepositsByPeriod(period) {
  // FIX: antes "hoy" salia de now.toISOString().slice(0, 10) -- fecha
  // calendario UTC, no Lima. Despues de las 19:00 hora Lima (cuando el dia
  // UTC ya rodo al siguiente) esto pedia el dia de MAÑANA como si fuera
  // "hoy". toLocalISOString ya calcula el dia calendario correcto en huso
  // America/Lima (igual que hace el resto del archivo).
  const hoy = toLocalISOString(new Date());

  if (period === "today") {
    return fetchDepositsByDate(hoy);
  }

  if (period === "week") {
    const desdeStr = addDaysToDateStr(hoy, -7);
    return fetchDepositsList({ desde: limaDayRangeStart(desdeStr), hasta: limaDayRangeEnd(hoy) });
  }

  if (typeof period === "string" && period.startsWith("month:")) {
    const [year, month] = period.slice("month:".length).split("-").map(Number);
    const desdeStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const hastaStr = `${year}-${String(month).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
    return fetchDepositsList({ desde: limaDayRangeStart(desdeStr), hasta: limaDayRangeEnd(hastaStr) });
  }

  if (period === "month" || period === "mes") {
    const [year, month] = hoy.split("-");
    return fetchDepositsList({ desde: limaDayRangeStart(`${year}-${month}-01`), hasta: limaDayRangeEnd(hoy) });
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
// Todos los campos editables del modal de detalle viajan acá al confirmar o
// rechazar -- lo que trajo el OCR/IA al crear el depósito no necesariamente
// es correcto, y finanzas puede corregir cualquiera de estos antes de
// resolverlo. El backend solo pisa el campo que llega con valor (no
// vacío/null), así que mandar solo lo que cambió es seguro. La imagen del
// voucher NO se manda acá a propósito: el reemplazo de imagen tiene su
// propio flujo dedicado (finanzas-regularize-image).
function buildEditableFieldsBody({
  anexo,
  numeroOperacion,
  empresaId,
  bancoId,
  monto,
  moneda,
  fechaDeposito,
  cliente,
  rucCliente,
  referenciaCliente,
  numeroTarjeta,
} = {}) {
  const body = {};
  if (anexo) body.anexo = anexo;
  // El backend limpia letras/espacios antes de guardar (NumeroOperacion es
  // solo numeros) -- acá se manda tal cual lo editó finanzas.
  if (numeroOperacion) body.numeroOperacion = numeroOperacion;
  if (empresaId) body.empresaId = empresaId;
  if (bancoId) body.bancoId = bancoId;
  if (monto !== undefined && monto !== null && monto !== "") body.monto = Number(monto);
  if (moneda) body.moneda = moneda;
  if (fechaDeposito) body.fechaDeposito = fechaDeposito;
  if (cliente) body.cliente = cliente;
  if (rucCliente) body.rucCliente = rucCliente;
  if (referenciaCliente) body.referenciaCliente = referenciaCliente;
  if (numeroTarjeta) body.numeroTarjeta = numeroTarjeta;
  return body;
}

export async function confirmDeposit(id, { observaciones, ...editableFields } = {}) {
  const body = buildEditableFieldsBody(editableFields);
  if (observaciones) body.observaciones = observaciones;

  const data = await apiJson(`${DEPOSITS_BASE}/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data;
}

// POST /v1/deposits/{id}/reject — "observaciones" es obligatorio para el
// backend (RejectDepositRequest.Observaciones no es nullable); el resto de
// los campos editables son opcionales, igual que en confirm.
export async function rejectDeposit(id, { observaciones, ...editableFields } = {}) {
  const body = { ...buildEditableFieldsBody(editableFields), observaciones: observaciones || "" };

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

// POST /v1/deposits/{id}/mark-antiguo — Solo finanzas/admin (el backend valida
// el rol). "Condicion" normalmente se calcula solo (FechaDeposito < hoy =>
// "antiguo"), pero esto permite forzarlo a mano cuando la clasificacion
// automatica no aplica para un caso puntual. Independiente del Estado.
export async function markDepositAntiguo(id) {
  return apiJson(`${DEPOSITS_BASE}/${id}/mark-antiguo`, { method: "POST" });
}

// POST /v1/deposits/{id}/unmark-antiguo — vuelve Condicion a "actual".
export async function unmarkDepositAntiguo(id) {
  return apiJson(`${DEPOSITS_BASE}/${id}/unmark-antiguo`, { method: "POST" });
}

// POST /v1/deposits/{id}/restore-to-pending — Solo finanzas/admin (el backend
// valida el rol). Devuelve un depósito rechazado a "procesado" sin asignar
// (validado_por limpio), para que cualquiera lo pueda tomar de nuevo -- el
// backend también limpia motivo_rechazo/fecha_validacion/fecha_bloqueo.
// Solo funciona si el depósito está actualmente "rechazado" (el backend
// devuelve 400 si no).
export async function restoreDepositToPending(id) {
  return apiJson(`${DEPOSITS_BASE}/${id}/restore-to-pending`, { method: "POST" });
}

// POST /v1/deposits/pull-rezagados-a-hoy — Solo finanzas/admin. Trae a "hoy"
// los depósitos que siguen "procesado" con fecha de registro de un día
// anterior (rezagados que quedaron sin revisar, ej. porque llegaron después
// del horario de oficina). Les actualiza fecha_registro al momento del click
// y los marca condicion="antiguo". Devuelve { movedCount, depositIds }.
export async function pullRezagadosAHoy() {
  return apiJson(`${DEPOSITS_BASE}/pull-rezagados-a-hoy`, { method: "POST" });
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

// GET /v1/deposits/regularizaciones-historial — Solo finanzas/admin. Historial
// de TODOS los eventos de regularizacion (marcado/resuelto/desmarcado) sobre
// el flag pendienteRegularizar, para auditoria/reporteria (no es el timeline
// de un solo deposito, es el listado agregado entre todos). Filtros opcionales
// por rango de fecha, accion y empresa.
//
// FIX: desde/hasta llegan como "YYYY-MM-DD" (del <input type="date"> de la
// vista) y antes se armaban acá mismo como `${desde}T00:00:00.000Z` /
// `${hasta}T23:59:59.999Z` -- igual que el bug ya corregido en
// dateToDayRange (ver su comentario más arriba): esas horas son de pared en
// Lima, no UTC. Con el "Z" literal, "hasta" terminaba equivaliendo a las
// 18:59:59 hora Lima (no 23:59:59), así que cualquier evento de regularizar
// ocurrido entre las 7pm y la medianoche quedaba afuera del rango
// seleccionado -- el filtro por fecha "perdía" resultados de la noche.
// dateToDayRange ya resuelve esto correctamente, igual que en
// fetchDepositsByRange.
export async function fetchRegularizacionesHistorial({ desde, hasta, accion, empresaId } = {}) {
  const params = new URLSearchParams();
  if (desde) {
    const { desde: desdeUtc } = dateToDayRange(desde);
    params.set("desde", desdeUtc);
  }
  if (hasta) {
    const { hasta: hastaUtc } = dateToDayRange(hasta);
    params.set("hasta", hastaUtc);
  }
  if (accion) params.set("accion", accion);
  if (empresaId) params.set("empresaId", empresaId);
  const query = params.toString();
  const data = await apiJson(`${DEPOSITS_BASE}/regularizaciones-historial${query ? `?${query}` : ""}`);
  return Array.isArray(data) ? data : [];
}

// URLs firmadas (redirect a GCS) para el voucher ANTERIOR/NUEVO de un evento
// "resuelto" en el historial de regularizaciones. Mismo patron que
// buildVoucherImageUrl: el token va como query param porque <img src> no
// puede mandar header Authorization.
function buildRegularizacionImagenUrl(regularizacionId, tipo) {
  if (!regularizacionId) return null;
  const token = getStoredAccessToken();
  if (!token) return null;
  return buildApiUrl(
    `${API_BASE}${DEPOSITS_BASE}/regularizaciones-historial/${regularizacionId}/imagen-${tipo}?access_token=${encodeURIComponent(token)}`
  );
}

export function getRegularizacionImagenAnteriorUrl(regularizacionId) {
  return buildRegularizacionImagenUrl(regularizacionId, "anterior");
}

export function getRegularizacionImagenNuevaUrl(regularizacionId) {
  return buildRegularizacionImagenUrl(regularizacionId, "nueva");
}

// GET /v1/deposits/{id}/rechazos-historial — Solo finanzas/admin. A diferencia
// de fetchRegularizacionesHistorial (agregado entre TODOS los depositos, y
// solo del flujo de marcar/resolver de finanzas), esto trae el timeline de
// rechazos-regularizados de UN depósito puntual, capturado automaticamente
// cada vez que el vendedor regulariza un depósito rechazado desde la app
// (PUT /{id}/regularize) -- antes ese voucher/motivo se perdía sin dejar
// rastro. Ver DepositDetailModal.jsx, bloque "Historial de rechazos".
export async function fetchRechazosHistorial(depositId) {
  if (!depositId) return [];
  const data = await apiJson(`${DEPOSITS_BASE}/${depositId}/rechazos-historial`);
  return Array.isArray(data) ? data : [];
}

// URL firmada (redirect a GCS) del voucher que causó un rechazo, guardado en
// deposito_rechazos_historial. Mismo patron de access_token por query param
// que buildRegularizacionImagenUrl (un <img src>/<a href> no puede mandar
// header Authorization).
export function getRechazoHistorialImagenUrl(rechazoId) {
  if (!rechazoId) return null;
  const token = getStoredAccessToken();
  if (!token) return null;
  return buildApiUrl(
    `${API_BASE}${DEPOSITS_BASE}/rechazos-historial/${rechazoId}/imagen?access_token=${encodeURIComponent(token)}`
  );
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

// GET /v1/deposits/export-vouchers-zip — respaldo masivo de vouchers en ZIP,
// organizado por fecha de depósito y, dentro de cada fecha, por sucursal
// (solo finanzas/admin, el backend valida el rol). El backend SIEMPRE filtra
// solo depositos validados (Estado = confirmado), eso no es opcional desde
// aqui. Filtros opcionales: sucursalId, fechaDesde/fechaHasta (YYYY-MM-DD,
// sobre FechaDeposito). Devuelve el blob del ZIP tal cual, listo para
// disparar la descarga en el navegador.
export async function exportVouchersZip({ sucursalId, fechaDesde, fechaHasta } = {}) {
  const params = new URLSearchParams();
  if (sucursalId) params.append("sucursalId", sucursalId);
  if (fechaDesde) params.append("fechaDesde", fechaDesde);
  if (fechaHasta) params.append("fechaHasta", fechaHasta);

  const query = params.toString();
  return apiBlob(`${DEPOSITS_BASE}/export-vouchers-zip${query ? `?${query}` : ""}`);
}

export async function checkDuplicate(payload) {
  if (MOCK_MODE_ENABLED) return { duplicates: [] };
  const data = await apiJson(`${DEPOSITS_BASE}/check-duplicate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  // Los duplicados vienen en camelCase (y a veces con relaciones anidadas)
  // igual que el listado; hay que normalizarlos con mapDeposit para que el
  // modal muestre empresa/banco/nro operación/importe/fechas y no "-".
  return {
    ...data,
    duplicates: Array.isArray(data?.duplicates)
      ? data.duplicates.map(mapDeposit)
      : [],
  };
}
