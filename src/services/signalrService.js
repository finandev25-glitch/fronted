import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";

let activeConnection = null;

function normalizeBaseUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.endsWith("/") ? text.slice(0, -1) : text;
}

export function getSignalRHubUrl() {
  if (typeof window !== "undefined") {
    const runtimeUrl = normalizeBaseUrl(window.__SIGNALR_HUB_URL__);
    if (runtimeUrl) return runtimeUrl;
  }

  return normalizeBaseUrl(import.meta.env.VITE_SIGNALR_HUB_URL || "/hubs/deposits");
}

export function getStoredAccessToken() {
  try {
    const raw = localStorage.getItem("control-depositos-auth-session");
    if (!raw) return null;

    const session = JSON.parse(raw);
    return session?.access_token || null;
  } catch {
    return null;
  }
}

function normalizeEventPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const base = payload.new || payload.record || payload.data || payload;
  const id = base.id || base.depositId || payload.depositId || null;
  return id ? { ...base, id } : base;
}

// Eventos reales que emite Confirmo.Api (SignalRNotificationService.cs), a nivel
// de usuario individual (Clients.User(vendedorId)). Ninguno trae el deposito
// completo actualizado, solo el depositId y metadata puntual, asi que se tratan
// todos como "algo cambio" y disparan un refetch completo via onInsert.
const DEPOSIT_CHANGED_EVENTS = [
  "DepositReceived",
  "DepositProcessingUpdateStatusUpdate",
  "DepositConfirmed",
  "DepositRejected",
  "QualityRejected",
  "ValidationErrors",
  "RequiresReview",
];

// Eventos de panel/finanzas (Clients.Group("panel"/"finance")). El backend los
// manda a esos grupos, y ahora el cliente SI se une (ver joinPanelGroup mas
// abajo, invocado tras connection.start() y de nuevo en cada reconexion).
// Incluye el candado de validacion (lock/unlock del deposito): el backend
// emite PanelDepositLocked/PanelDepositUnlocked con el mismo patron que
// PanelDepositStatusChanged.
const PANEL_EVENTS = [
  "PanelNewDeposit",
  "PanelDepositStatusChanged",
  "PanelStatsUpdate",
  "PanelDepositLocked",
  "PanelDepositUnlocked",
];

// Une la conexion actual a los grupos "panel"/"finance" del Hub, para que
// los eventos de PANEL_EVENTS (incluido el candado de validacion) le lleguen
// al cliente. El Hub exige rol finanzas/admin (DepositHub.JoinPanelGroup):
// para otros roles simplemente no los une y manda un evento "Error" inofensivo,
// no lanza excepcion — por eso esto se puede invocar siempre, sin chequear rol
// aqui en el cliente.
async function joinPanelGroup(connection) {
  try {
    await connection.invoke("JoinPanelGroup");
  } catch (error) {
    console.warn("No se pudo unir al grupo de panel (SignalR):", error?.message || error);
  }
}

function registerEventHandlers(connection, handlers = {}) {
  const makeHandler = (eventName) => (payload) => {
    console.log(`📡 SignalR evento recibido: ${eventName}`, payload);
    handlers.onInsert?.(normalizeEventPayload(payload));
  };

  const boundHandlers = [...DEPOSIT_CHANGED_EVENTS, ...PANEL_EVENTS].map((eventName) => {
    const handler = makeHandler(eventName);
    connection.on(eventName, handler);
    return [eventName, handler];
  });

  // El Hub manda "Error" cuando JoinPanelGroup se invoca con un rol distinto
  // de finanzas/admin (caso normal para vendedores) — se registra para que
  // no quede como "no client method found" en la consola del navegador.
  const onHubError = (payload) => {
    console.debug("ℹ️ SignalR: evento Error del hub (probablemente rol sin acceso a panel)", payload);
  };
  connection.on("Error", onHubError);
  connection.on("PanelJoined", (payload) => {
    console.log("✅ SignalR: unido al grupo de panel", payload);
  });

  return () => {
    boundHandlers.forEach(([eventName, handler]) => connection.off(eventName, handler));
    connection.off("Error", onHubError);
    connection.off("PanelJoined");
  };
}

export async function startDepositSignalRConnection({
  hubUrl = getSignalRHubUrl(),
  accessTokenFactory = getStoredAccessToken,
  onInsert,
  onUpdate,
  onDelete,
  onStatusChange,
  onError,
} = {}) {
  if (!hubUrl) {
    onStatusChange?.("DISCONNECTED");
    return null;
  }

  if (activeConnection && activeConnection.state !== HubConnectionState.Disconnected) {
    try {
      await activeConnection.stop();
    } catch {
      // Ignore previous connection cleanup issues.
    }
    activeConnection = null;
  }

  const connection = new HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => accessTokenFactory?.() || "",
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
    .configureLogging(LogLevel.Information)
    .build();

  const removeHandlers = registerEventHandlers(connection, { onInsert, onUpdate, onDelete });

  connection.onreconnecting((error) => {
    onStatusChange?.("RECONNECTING", error || null);
  });

  connection.onreconnected(() => {
    // Los grupos de SignalR NO persisten entre reconexiones (connectionId
    // nuevo) — sin esto, tras una reconexion el cliente dejaria de recibir
    // los eventos de PANEL_EVENTS silenciosamente hasta recargar la pagina.
    void joinPanelGroup(connection);
    onStatusChange?.("SUBSCRIBED");
  });

  connection.onclose((error) => {
    onStatusChange?.(error ? "CHANNEL_ERROR" : "CLOSED", error || null);
  });

  activeConnection = connection;
  onStatusChange?.("CONNECTING");

  try {
    await connection.start();
    await joinPanelGroup(connection);
    onStatusChange?.("SUBSCRIBED");
    return connection;
  } catch (error) {
    onError?.(error);
    onStatusChange?.("CHANNEL_ERROR", error);
    removeHandlers();
    activeConnection = null;
    try {
      await connection.stop();
    } catch {
      // Ignore stop errors on failed startup.
    }
    return null;
  }
}

export async function stopDepositSignalRConnection() {
  if (!activeConnection) {
    return;
  }

  try {
    await activeConnection.stop();
  } catch {
    // Ignore stop errors.
  } finally {
    activeConnection = null;
  }
}

export function getActiveDepositSignalRConnection() {
  return activeConnection;
}
