/**
 * SystemPulseMonitor.jsx
 *
 * Indicador de estado del sistema con estética de monitor de signos vitales
 * (pedido explícito: "como una pantalla de un hospital"):
 *   - Conectado     -> línea de electrocardiograma verde, latido regular.
 *   - Reconectando  -> línea ámbar, latido débil e irregular.
 *   - Sin conexión  -> línea roja plana (parpadea).
 *
 * El estado lo calcula useSystemHealth (internet + /health + SignalR).
 * Las animaciones (keyframes "ecg-scroll" / "ecg-flat-blink") están en
 * index.css y se desactivan con prefers-reduced-motion.
 */
import { useSystemHealth } from "../../hooks/useSystemHealth.js";

// Un "latido" ocupa 100 unidades de ancho; línea base en y=22.
// Onda P (bulto chico) -> complejo QRS (pico) -> onda T (bulto).
const BEAT_OK = "L28,22 Q32,18 36,22 L42,22 L45,26 L49,4 L53,32 L56,22 L64,22 Q70,15 76,22 L100,22";
// Latido débil: picos más bajos y uno de cada dos "se pierde".
const BEAT_WEAK = "L40,22 L43,24 L46,13 L49,27 L52,22 L100,22";
const BEAT_SKIP = "L100,22";

function buildTrace(beats) {
  // 4 latidos = 400 de ancho. El SVG mide el doble del recuadro visible y se
  // desplaza -50% en bucle, así el trazo parece correr sin cortes.
  let d = "M0,22";
  beats.forEach((beat, index) => {
    const offset = index * 100;
    d += " " + beat.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${Number(x) + offset},${y}`);
  });
  return d;
}

const TRACES = {
  ok: buildTrace([BEAT_OK, BEAT_OK, BEAT_OK, BEAT_OK]),
  degraded: buildTrace([BEAT_WEAK, BEAT_SKIP, BEAT_WEAK, BEAT_SKIP]),
  down: "M0,22 L400,22",
};

const THEME = {
  ok: { stroke: "#22c55e", text: "text-emerald-400", label: "En línea", dot: "bg-emerald-400", duration: "2.4s" },
  degraded: { stroke: "#f59e0b", text: "text-amber-400", label: "Reconectando…", dot: "bg-amber-400", duration: "4s" },
  down: { stroke: "#ef4444", text: "text-red-400", label: "Sin conexión", dot: "bg-red-500", duration: "0s" },
};

function formatHour(date) {
  if (!date) return "—";
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function SystemPulseMonitor({ realtimeStatus }) {
  const health = useSystemHealth({ realtimeStatus });
  // Imágenes bloqueadas: el sistema funciona (no es "reconectando"), así que
  // se muestra ámbar con su propia etiqueta para no confundir al usuario.
  const theme = health.status === "degraded" && health.cause === "images"
    ? { ...THEME.degraded, label: "Sin imágenes" }
    : THEME[health.status];

  const tooltip = [
    `Estado: ${health.reason}`,
    `Internet: ${health.online ? "conectado" : "sin conexión"}`,
    `Servidor: ${
      health.serverOk === null ? "verificando…" : health.serverOk ? `OK (${health.latencyMs} ms)` : "sin respuesta"
    }`,
    `Tiempo real: ${health.realtimeLabel}`,
    `Imágenes: ${
      health.imagesOk === null ? "verificando…" : health.imagesOk ? "OK" : "bloqueadas por la red (Google Storage)"
    }`,
    `Última verificación: ${formatHour(health.lastCheckAt)}`,
    "Clic para verificar ahora",
  ].join("\n");

  return (
    <button
      type="button"
      onClick={() => void health.recheck()}
      title={tooltip}
      aria-label={`Estado del sistema: ${theme.label}. ${health.reason}`}
      className="group flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 shadow-inner transition-colors hover:border-slate-600"
    >
      {/* Pantalla del monitor: fondo oscuro con cuadrícula tenue */}
      <span
        className="relative block h-7 w-28 overflow-hidden rounded"
        style={{
          backgroundColor: "#020a05",
          backgroundImage:
            "linear-gradient(rgba(34,197,94,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.08) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      >
        <svg
          viewBox="0 0 400 44"
          preserveAspectRatio="none"
          className={`absolute inset-y-0 left-0 h-full w-[200%] ${
            health.status === "down" ? "ecg-flat-blink" : "ecg-scroll"
          }`}
          style={{ animationDuration: health.status === "down" ? undefined : theme.duration }}
          aria-hidden="true"
        >
          <path
            d={TRACES[health.status]}
            fill="none"
            stroke={theme.stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 2px ${theme.stroke})` }}
          />
        </svg>
        {/* Desvanecido a la izquierda: el trazo "viejo" se apaga como en un monitor real */}
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-8"
          style={{ background: "linear-gradient(90deg, #020a05, transparent)" }}
        />
      </span>

      {/* Lectura: estado + latencia, como el valor numérico del monitor */}
      <span className="flex flex-col items-start leading-none">
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${theme.text}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${theme.dot} ${health.status === "ok" ? "animate-pulse" : ""}`} />
          {theme.label}
        </span>
        <span className="mt-0.5 font-mono text-[10px] text-slate-400">
          {health.status === "down"
            ? health.online
              ? "servidor caído"
              : "sin internet"
            : health.cause === "images"
              ? "imágenes bloqueadas"
              : health.latencyMs != null
              ? `${health.latencyMs} ms`
              : "verificando…"}
        </span>
      </span>
    </button>
  );
}

export default SystemPulseMonitor;
