import React, { createContext, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../services/backendApi.js";
import { getClaimsFromToken } from "../lib/jwt.js";

export const AuthContext = createContext();

const SESSION_KEY = "control-depositos-auth-session";
const CURRENT_USER_KEY = "control-depositos-current-user";

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

  const applySession = (accessToken, refreshToken, expiresInSeconds, user) => {
    const normalizedUser = buildUserFromLoginResponse(user, accessToken);
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + Math.max(0, (expiresInSeconds || 0) * 1000),
    };

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
      const message = error.status === 401 ? "Numero de telefono o contrasena incorrectos." : error.message;
      return { data: null, error: { message } };
    }
  };

  const logout = async () => {
    clearStoredAuth();
    setCurrentUser(null);
    setUsers([]);
    setAuthSession(null);
  };

  const register = async (fullName, email, password) => {
    try {
      const response = await apiPost("/auth/register", {
        fullName,
        email,
        password,
      });

      return { data: response?.data || null, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message } };
    }
  };

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
    register,
    users,
    updateUserProfile,
    createUserProfile,
    resetUserPassword,
    refreshUsers,
    authSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
