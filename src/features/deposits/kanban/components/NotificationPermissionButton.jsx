import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

/**
 * Botón para activar las notificaciones nativas del navegador. El permiso debe
 * solicitarse desde un gesto del usuario, así que este botón hace la petición
 * al hacer clic. Se oculta cuando ya está concedido o no es soportado.
 */
export function NotificationPermissionButton() {
  const supported =
    typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState(
    supported ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    if (!supported) return;
    // Reflejar cambios de permiso hechos desde la barra del navegador.
    const sync = () => setPermission(Notification.permission);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [supported]);

  if (!supported || permission === "granted") return null;

  const denied = permission === "denied";

  const handleClick = async () => {
    if (denied) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        // Confirmación inmediata de que las notificaciones funcionan.
        try {
          new Notification("✅ Notificaciones activadas", {
            body: "Te avisaremos cuando haya más de 3 depósitos pendientes hoy.",
            tag: "notif-activadas",
          });
        } catch {
          // Ignorar si el navegador no permite crearla en este momento.
        }
      }
    } catch {
      setPermission(Notification.permission);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={denied}
      title={
        denied
          ? "Notificaciones bloqueadas. Habilítalas desde la configuración del navegador."
          : "Activar notificaciones de nuevos pendientes"
      }
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
        denied
          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
      }`}
    >
      {denied ? <BellOff size={14} /> : <Bell size={14} />}
      <span>{denied ? "Notificaciones bloqueadas" : "Activar notificaciones"}</span>
    </button>
  );
}

export default NotificationPermissionButton;
