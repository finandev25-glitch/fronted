import { createInitialMockState } from "./mockData.js";

export const MOCK_MODE_ENABLED = String(import.meta.env.VITE_USE_MOCK_DATA || "").toLowerCase() === "true";

let mockState = createInitialMockState();

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function blobResponse(text, type = "text/plain") {
  return new Response(new Blob([text], { type }), {
    status: 200,
    headers: { "Content-Type": type },
  });
}

function getRequestUrl(input) {
  if (typeof input === "string") {
    return new URL(input, window.location.origin);
  }

  if (input instanceof Request) {
    return new URL(input.url, window.location.origin);
  }

  return new URL(String(input), window.location.origin);
}

function parseBody(init) {
  if (!init?.body) return null;
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch {
      return init.body;
    }
  }
  return init.body;
}

function enrichDeposit(deposit) {
  const empresa = mockState.empresas.find((item) => String(item.id) === String(deposit.empresa_id)) || null;
  const banco = mockState.bancos.find((item) => String(item.id) === String(deposit.banco_id)) || null;
  const sucursal = mockState.sucursales.find((item) => String(item.id) === String(deposit.sucursal_id)) || null;
  const trabajador =
    mockState.personal.find((item) => String(item.id) === String(deposit.trabajador_sucursal_id)) || null;
  const validadoPorUsuario =
    mockState.users.find((item) => String(item.id) === String(deposit.validado_por)) || null;

  return {
    ...deposit,
    empresa: empresa ? { id: empresa.id, nombre: empresa.nombre, estado: empresa.estado } : null,
    banco: banco ? { id: banco.id, abreviatura: banco.abreviatura, nombre: banco.nombre, estado: banco.estado } : null,
    sucursal: sucursal ? { id: sucursal.id, nombre: sucursal.nombre } : null,
    trabajador: trabajador ? { id: trabajador.id, nombre: trabajador.nombre, telefono_origen: trabajador.telefono_origen } : null,
    validado_por_usuario: validadoPorUsuario ? { id: validadoPorUsuario.id, nombre: validadoPorUsuario.nombre } : null,
  };
}

function getFilteredDeposits(url) {
  let items = [...mockState.deposits];
  const date = url.searchParams.get("date");
  const period = url.searchParams.get("period");

  if (date) {
    items = items.filter((item) => item.fecha_solo_date === date);
  } else if (period === "today") {
    const today = new Date().toISOString().slice(0, 10);
    items = items.filter((item) => item.fecha_solo_date === today);
  } else if (period === "week") {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    items = items.filter((item) => new Date(item.fecha_registro) >= start);
  } else if (period === "month" || period === "mes") {
    const now = new Date();
    items = items.filter((item) => {
      const dateValue = new Date(item.fecha_registro);
      return (
        dateValue.getFullYear() === now.getFullYear() &&
        dateValue.getMonth() === now.getMonth()
      );
    });
  }

  return items.map(enrichDeposit);
}

function buildReportSummary() {
  const deposits = mockState.deposits.map(enrichDeposit);
  const cantidad_depositos = deposits.length;
  const depositos_validados = deposits.filter((item) => item.estado === "validado").length;
  const depositos_rechazados = deposits.filter((item) => item.estado === "rechazado").length;
  const monto_total_pen = deposits
    .filter((item) => item.moneda === "PEN")
    .reduce((sum, item) => sum + Number(item.monto || 0), 0);
  const monto_total_usd = deposits
    .filter((item) => item.moneda === "USD")
    .reduce((sum, item) => sum + Number(item.monto || 0), 0);

  return {
    summary: {
      cantidad_depositos,
      depositos_validados,
      depositos_rechazados,
      monto_total_pen,
      monto_total_usd,
    },
    bySucursal: mockState.sucursales.map((item) => ({
      nombre: item.nombre,
      total: deposits.filter((deposit) => deposit.sucursal_id === item.id).length,
    })),
    byBanco: mockState.bancos.map((item) => ({
      nombre: item.abreviatura,
      total: deposits.filter((deposit) => deposit.banco_id === item.id).length,
    })),
    trends: deposits.map((item) => ({
      fecha: item.fecha_solo_date,
      total: Number(item.monto || 0),
    })),
    confirmedRejectedUSD: [],
    confirmedRejectedPEN: [],
    topSucursales: [],
    rejectedBySucursal: [],
  };
}

function nextId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function handleAuth(method, path, body) {
  if (method === "POST" && path === "/api/auth/login") {
    const user = mockState.users.find((item) => item.email === body?.email) || mockState.users[0];
    return jsonResponse({
      data: {
        user,
        session: {
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          user,
        },
      },
    });
  }

  if (method === "POST" && path === "/api/auth/me") {
    return jsonResponse({ data: { user: mockState.users[0] } });
  }

  if (method === "POST" && path === "/api/auth/register") {
    const newUser = {
      id: `user-${Date.now()}`,
      nombre: body?.fullName || "Nuevo Usuario",
      usuario: String(body?.email || "nuevo@demo.local").split("@")[0],
      email: body?.email || "nuevo@demo.local",
      user_rol: "finanzas",
      rol: "finanzas",
      estado: "inactivo",
    };
    mockState.users.push(newUser);
    return jsonResponse({ data: newUser }, 201);
  }

  if (method === "POST" && path === "/api/auth/logout") {
    return jsonResponse({ ok: true });
  }

  return null;
}

function handleUsers(method, path, body) {
  if (method === "GET" && path === "/api/users/details") {
    return jsonResponse({ data: mockState.users });
  }

  const profileMatch = path.match(/^\/api\/users\/([^/]+)\/profile$/);
  if (profileMatch && method === "GET") {
    const user = mockState.users.find((item) => String(item.id) === String(profileMatch[1]));
    return jsonResponse({ data: user || null });
  }

  if (profileMatch && method === "PUT") {
    const index = mockState.users.findIndex((item) => String(item.id) === String(profileMatch[1]));
    if (index >= 0) {
      mockState.users[index] = { ...mockState.users[index], ...body };
      return jsonResponse({ data: mockState.users[index] });
    }
    return jsonResponse({ error: "Usuario no encontrado" }, 404);
  }

  return null;
}

function handleCatalogCrud(method, path, body) {
  const configs = [
    ["bancos", mockState.bancos],
    ["empresas", mockState.empresas],
    ["cuentas-bancarias", mockState.cuentas],
    ["sucursales", mockState.sucursales],
    ["personal", mockState.personal],
  ];

  for (const [segment, collection] of configs) {
    if (path === `/api/${segment}` && method === "GET") {
      return jsonResponse({ data: collection });
    }

    if (path === `/api/${segment}` && method === "POST") {
      const item = { id: nextId(collection), ...body };
      collection.push(item);
      return jsonResponse({ data: item }, 201);
    }

    const match = path.match(new RegExp(`^/api/${segment}/([^/]+)$`));
    if (match && method === "PUT") {
      const index = collection.findIndex((item) => String(item.id) === String(match[1]));
      if (index >= 0) {
        collection[index] = { ...collection[index], ...body };
        return jsonResponse({ data: collection[index] });
      }
    }

    if (match && method === "DELETE") {
      const index = collection.findIndex((item) => String(item.id) === String(match[1]));
      if (index >= 0) {
        collection.splice(index, 1);
      }
      return jsonResponse({ ok: true });
    }
  }

  return null;
}

function handleDeposits(method, path, url, body) {
  if (method === "GET" && path === "/api/depositos") {
    return jsonResponse({ data: getFilteredDeposits(url) });
  }

  const depositMatch = path.match(/^\/api\/depositos\/([^/]+)$/);
  if (depositMatch && method === "PUT") {
    const index = mockState.deposits.findIndex((item) => String(item.id) === String(depositMatch[1]));
    if (index >= 0) {
      mockState.deposits[index] = { ...mockState.deposits[index], ...body };
      return jsonResponse({ data: enrichDeposit(mockState.deposits[index]) });
    }
    return jsonResponse({ error: "Deposito no encontrado" }, 404);
  }

  if (depositMatch && method === "DELETE") {
    mockState.deposits = mockState.deposits.filter((item) => String(item.id) !== String(depositMatch[1]));
    return jsonResponse({ ok: true });
  }

  return null;
}

function handleBootstrap(method, path) {
  if (method === "GET" && path === "/api/dashboard/bootstrap") {
    return jsonResponse({
      bancos: mockState.bancos,
      empresas: mockState.empresas,
      cuentas: mockState.cuentas,
      sucursales: mockState.sucursales,
      personal: mockState.personal,
    });
  }

  if (method === "GET" && path === "/api/health") {
    return jsonResponse({
      ok: true,
      clients: 0,
      realtime: false,
      realtimeStatus: "DISABLED",
      buildSha: "mock",
    });
  }

  return null;
}

function handleReports(method, path) {
  if (method === "GET" && path === "/api/reportes/summary") {
    return jsonResponse(buildReportSummary());
  }

  return null;
}

function handleSupport(method, path, body) {
  if (method === "POST" && path === "/api/support-requests") {
    const item = {
      id: nextId(mockState.supportRequests),
      created_at: new Date().toISOString(),
      ...body,
    };
    mockState.supportRequests.push(item);
    return jsonResponse({ data: item }, 201);
  }

  if (method === "GET" && path === "/api/support-requests") {
    return jsonResponse({ data: mockState.supportRequests });
  }

  return null;
}

function handleDriveAndFiles(method, path) {
  if (path.startsWith("/api/drive-files")) {
    if (method === "GET") return jsonResponse({ data: mockState.driveFiles });
    return jsonResponse({ success: true, data: [] });
  }

  if (path.startsWith("/api/documentos")) {
    return jsonResponse({ data: [] });
  }

  if (path.startsWith("/api/export")) {
    return blobResponse("mock export", "application/octet-stream");
  }

  return null;
}

function handleSqlServer(path) {
  if (path.startsWith("/api/sqlserver/")) {
    return jsonResponse({ data: [], meta: { source: "mock" } });
  }
  return null;
}

function handleFallback(method, path) {
  if (method === "GET") {
    return jsonResponse({ data: [] });
  }

  return jsonResponse({ success: true, data: null, message: `Mocked ${path}` });
}

export async function handleMockApiRequest(input, init = {}) {
  const url = getRequestUrl(input);
  if (!url.pathname.startsWith("/api")) {
    return null;
  }

  // Rutas del backend real (Confirmo.Api) usan el prefijo /api/v1 y no deben
  // ser interceptadas por el mock, aunque VITE_USE_MOCK_DATA este activo.
  if (url.pathname.startsWith("/api/v1/")) {
    return null;
  }

  const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const path = url.pathname;
  const body = parseBody(init);

  return (
    handleAuth(method, path, body) ||
    handleUsers(method, path, body) ||
    handleBootstrap(method, path) ||
    handleCatalogCrud(method, path, body) ||
    handleDeposits(method, path, url, body) ||
    handleReports(method, path) ||
    handleSupport(method, path, body) ||
    handleDriveAndFiles(method, path) ||
    handleSqlServer(path) ||
    handleFallback(method, path)
  );
}

export function installMockApi() {
  if (!MOCK_MODE_ENABLED || typeof window === "undefined") {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const mockResponse = await handleMockApiRequest(input, init);
    if (mockResponse) {
      return mockResponse;
    }
    return originalFetch(input, init);
  };
}
