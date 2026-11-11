// Aviso global de "la sesión terminó". Cualquier llamada al backend que
// responda 401 (token vencido/inválido) dispara este evento, y AuthContext
// lo escucha para cerrar la sesión y mostrar la pantalla de login -- así la
// app no se queda "congelada" mostrando datos viejos.

export const SESSION_EXPIRED_EVENT = "confirmo:session-expired";

// Rutas cuyo 401 NO significa sesión vencida (p.ej. DNI/contraseña
// incorrectos en el login, o refresh token inválido al restaurar).
const AUTH_PATH_RE = /\/v1\/auth\//i;

export function notifySessionExpired(path = "") {
  if (AUTH_PATH_RE.test(String(path))) return;
  try {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { path } }));
  } catch {
    // window no disponible (tests/SSR): no hay nada que avisar.
  }
}
