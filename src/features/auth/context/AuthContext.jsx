import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../services/backendApi.js";
import { getClaimsFromToken } from "../lib/jwt.js";
import { SESSION_EXPIRED_EVENT } from "../../../services/sessionEvents.js";

export const AuthContext = createContext();

const SESSION_KEY = "control-depositos-auth-session";
const CURRENT_USER_KEY = "control-depositos-current-user";

export const SESSION_EXPIRED_MESSAGE = "Tu sesión expiró. Ingresa nuevamente para continuar.";
// setTimeout no acepta más de ~24.8 días; para vencimientos más lejanos se
// reprograma en tramos (en la práctica el token dura horas).
const MAX_TIMEOUT_MS = 2_000_000_000;
// Revisión periódica de respaldo: los timers se congelan si la PC entra en
// suspensión o la pestaña queda en segundo plano mucho tiempo.
const SESSION_CHECK_INTERVAL_MS = 30_000;

function readStoredJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`No se pudo leer ${key}:`, error);
    return null;
  }
}

function writeStoredJSON(key, value) {
  try {
    if (value == null) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`No se pudo guardar ${key}:`, error);
  }
}

function clearStoredAuth() {
  writeStoredJSON(SESSION_KEY, null);
  writeStoredJSON(CURRENT_USER_KEY, null);
}

function buildUserFromLoginResponse(user, accessToken) {
  const claims = getClaimsFromToken(accessToken) || {};
  const role = claims.role || "finanzas";

  return {
    id: user.id,
    nombre: user.fullName,
    usuario: user.phoneNumber,
    email: user.phoneNumber,
    phoneNumber: user.phoneNumber,
    user_rol: role,
    rol: role,
    estado: "activo",
    empresaId: user.empresaId,
    sucursalId: user.sucursalId,
    fcmToken: user.fcmToken,
    rawUser: user,
  };
}

function normalizeProfileResponse(profile) {
  return {
    id: profile.id,
    nombre: profile.fullName,
    usuario: profile.phoneNumber,
    email: profile.email,
    phoneNumber: profile.phoneNumber,
    user_rol: profile.rol,
    rol: profile.rol,
    estado: profile.activo ? "activo" : "inactivo",
    empresaId: profile.empresaId,
    sucursalId: profile.sucursalId,
    last_sign_in_at: profile.lastLoginAt,
    rawUser: profile,
  };
}

function isSessionExpired(session) {
  if (!session?.expires_at) return true;
  return Date.now() >= session.expires_at;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [authSession, setAuthSession] = useState(null);
  // Mensaje para la pantalla de login cuando la sesión se cerró sola
  // (token vencido, 401 del backend o cierre de sesión en otra pestaña).
  const [sessionNotice, setSessionNotice] = useState("");
  const expiringRef = useRef(false);

  const applySession = (accessToken, refreshToken, expiresInSeconds, user) => {
    const normalizedUser = buildUserFromLoginResponse(user, accessToken);
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + Math.max(0, (expiresInSeconds || 0) * 1000),
    };

    expiringRef.current = false;
    setSessionNotice("");
    setCurrentUser(normalizedUser);
    setAuthSession(session);
    setUsers([normalizedUser]);
    writeStoredJSON(SESSION_KEY, session);
    writeStoredJSON(CURRENT_USER_KEY, normalizedUser);

    return normalizedUser;
  };

  const restoreSession = async () => {
    const storedSession = readStoredJSON(SESSION_KEY);
    const storedUser = readStoredJSON(CURRENT_USER_KEY);

    if (!storedSession?.access_token || !storedUser) {
      clearStoredAuth();
      setLoading(false);
      return;
    }

    if (!isSessionExpired(storedSession)) {
      setCurrentUser(storedUser);
      setAuthSession(storedSession);
      setUsers([storedUser]);
      setLoading(false);
      return;
    }

    if (!storedSession.refresh_token) {
      clearStoredAuth();
      setLoading(false);
      return;
    }

    try {
      const refreshResult = await apiPost("/v1/auth/refresh", {
        refreshToken: storedSession.refresh_token,
      });

      const newSession = {
        ...storedSession,
        access_token: refreshResult.accessToken,
        expires_at: Date.now() + Math.max(0, (refreshResult.expiresInSeconds || 0) * 1000),
      };

      setCurrentUser(storedUser);
      setAuthSession(newSession);
      setUsers([storedUser]);
      writeStoredJSON(SESSION_KEY, newSession);
    } catch (error) {
      console.warn("No se pudo renovar la sesion:", error);
      clearStoredAuth();
      setCurrentUser(null);
      setAuthSession(null);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!active) return;
      await restoreSession();
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  const login = async (phoneNumber, password) => {
    try {
      const result = await apiPost("/v1/auth/login", { phoneNumber, password });

      if (!result?.accessToken || !result?.user) {
        throw new Error("No se pudo iniciar sesion");
      }

      const normalizedUser = applySession(
        result.accessToken,
        result.refreshToken,
        result.expiresInSeconds,
        result.user
      );

      return { data: { user: normalizedUser }, error: null };
    } catch (error) {
      const message = error.status === 401 ? "DNI o contraseña incorrectos." : error.message;
      return { data: null, error: { message } };
    }
  };

  const logout = async () => {
    setSessionNotice("");
    clearStoredAuth();
    setCurrentUser(null);
    setUsers([]);
    setAuthSession(null);
  };

  // Cierre automático: limpia todo y deja el aviso para AuthPage. Al quedar
  // currentUser en null, AppShell muestra la pantalla de login en lugar de
  // la vista congelada.
  const expireSession = useCallback((message = SESSION_EXPIRED_MESSAGE) => {
    if (expiringRef.current) return;
    expiringRef.current = true;
    clearStoredAuth();
    setSessionNotice(message);
    setCurrentUser(null);
    setUsers([]);
    setAuthSession(null);
  }, []);

  // 1) Vencimiento por reloj: dispara justo cuando expira el token.
  useEffect(() => {
    if (!currentUser || !authSession?.expires_at) return undefined;
    let timeoutId;
    const schedule = () => {
      const remaining = authSession.expires_at - Date.now();
      if (remaining <= 0) {
        expireSession();
        return;
      }
      timeoutId = setTimeout(schedule, Math.min(remaining, MAX_TIMEOUT_MS));
    };
    schedule();
    return () => clearTimeout(timeoutId);
  }, [currentUser, authSession?.expires_at, expireSession]);

  // 2) Respaldo: al volver a la pestaña / despertar la PC, y cada 30 s.
  useEffect(() => {
    if (!currentUser || !authSession?.expires_at) return undefined;
    const check = () => {
      if (Date.now() >= authSession.expires_at) expireSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const intervalId = setInterval(check, SESSION_CHECK_INTERVAL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentUser, authSession?.expires_at, expireSession]);

  // 3) El backend respondió 401 (token revocado, usuario desactivado, etc.).
  useEffect(() => {
    if (!currentUser) return undefined;
    const onExpired = () => expireSession();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [currentUser, expireSession]);

  // 4) Sesión cerrada en otra pestaña/ventana (incluida la ventana de
  //    validación compacta): localStorage avisa con el evento "storage".
  useEffect(() => {
    if (!currentUser) return undefined;
    const onStorage = (event) => {
      if (event.key === SESSION_KEY && !event.newValue) {
        expireSession("Se cerró la sesión. Ingresa nuevamente para continuar.");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [currentUser, expireSession]);

  // PUT /v1/masters/profiles/{id} reemplaza el perfil completo (solo admin),
  // asi que hay que partir del registro actual y aplicarle los cambios.
  const updateUserProfile = async (userId, updates) => {
    try {
      const existing = users.find((user) => String(user.id) === String(userId));
      if (!existing) {
        throw new Error("No se encontro el usuario a actualizar");
      }

      const nextEstado = updates.estado ?? existing.estado;
      const payload = {
        phoneNumber: updates.phoneNumber ?? existing.phoneNumber,
        email: updates.email ?? existing.email,
        fullName: updates.nombre ?? existing.nombre,
        empresaId: updates.empresaId ?? existing.empresaId,
        sucursalId: updates.sucursalId ?? existing.sucursalId,
        rol: updates.rol ?? existing.rol,
        activo: nextEstado === "activo",
      };

      const response = await apiPut(`/v1/masters/profiles/${userId}`, payload);
      const updatedProfile = normalizeProfileResponse(response);

      setUsers((prev) =>
        prev.map((user) => (String(user.id) === String(userId) ? updatedProfile : user))
      );

      if (String(currentUser?.id) === String(userId)) {
        setCurrentUser(updatedProfile);
        writeStoredJSON(CURRENT_USER_KEY, updatedProfile);
      }

      return updatedProfile;
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      throw error;
    }
  };

  // POST /v1/masters/profiles crea un Profile nuevo (cuenta de login), solo
  // admin (IsAdmin). CreateProfileRequest exige Password + FullName +
  // EmpresaId siempre, y ademas PhoneNumber o Email (al menos uno de los
  // dos); el backend valida unicidad de cada uno si vienen.
  const createUserProfile = async (data) => {
    try {
      const payload = {
        phoneNumber: data.phoneNumber || null,
        email: data.email || null,
        password: data.password,
        fullName: data.fullName || data.nombre || "",
        empresaId: data.empresaId,
        sucursalId: data.sucursalId || null,
        rol: data.rol,
      };

      const response = await apiPost("/v1/masters/profiles", payload);
      const createdProfile = normalizeProfileResponse(response);

      setUsers((prev) => [...prev, createdProfile]);

      return createdProfile;
    } catch (error) {
      console.error("Error creando perfil:", error);
      throw error;
    }
  };

  // PUT /v1/masters/profiles/{id}/password (solo admin). Endpoint separado
  // del PUT normal de perfil porque UpdateProfileRequest no incluye password.
  // El backend exige minimo 8 caracteres (ResetProfilePasswordRequest).
  const resetUserPassword = async (userId, newPassword) => {
    try {
      await apiPut(`/v1/masters/profiles/${userId}/password`, { newPassword });
      return true;
    } catch (error) {
      console.error("Error restableciendo contraseña:", error);
      throw error;
    }
  };

  const refreshUsers = useCallback(async () => {
    try {
      const response = await apiGet("/v1/masters/profiles");
      const list = (response || []).map(normalizeProfileResponse);
      setUsers(list.length ? list : currentUser ? [currentUser] : []);
      return list;
    } catch (error) {
      console.warn("No se pudo refrescar la lista de usuarios:", error);
      return [];
    }
  }, [currentUser]);

  const value = {
    currentUser,
    loading,
    login,
    logout,
    users,
    updateUserProfile,
    createUserProfile,
    resetUserPassword,
    refreshUsers,
    authSession,
    sessionNotice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
