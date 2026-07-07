function base64UrlDecode(segment) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return decodeURIComponent(
    atob(padded)
      .split("")
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
}

export function decodeJwt(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (error) {
    console.warn("No se pudo decodificar el token JWT:", error);
    return null;
  }
}

const CLAIM_ROLE = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const CLAIM_NAME_IDENTIFIER = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const CLAIM_NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";

export function getClaimsFromToken(token) {
  const payload = decodeJwt(token);
  if (!payload) return null;

  return {
    userId: payload[CLAIM_NAME_IDENTIFIER] || payload.sub || null,
    fullName: payload[CLAIM_NAME] || null,
    role: payload[CLAIM_ROLE] || payload.role || null,
    exp: payload.exp || null,
  };
}
