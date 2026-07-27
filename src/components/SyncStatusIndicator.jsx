import React, { useState } from "react";
import { AlertTriangle, Clock, RefreshCw, RotateCw, X } from "lucide-react";
import { useSyncStatus } from "../features/sync-status/hooks/useSyncStatus.js";

const STATUS_COLORS = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  unknown: "bg-gray-400",
};

const STATUS_LABELS = {
  ok: "Sincronización al día",
  warning: "Sincronización demorada",
  critical: "Sincronización caída",
  unknown: "Sin datos de sincronización",
};

function formatRelativeTime(iso) {
  if (!iso) return "nunca";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "nunca";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "hace instantes";
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;

  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} d`;
}

// Indicador flotante, siempre visible (cualquier pestaña/pantalla del panel),
// del estado de sincronización SQL Server -> Cloud SQL que hace bank-sync-worker.
// Un punto de color avisa de un vistazo si algo se cayó, sin tener que abrir
// el modal "Consulta SQL Server" para descubrirlo recién ahí.
export default function SyncStatusIndicator() {
  const { enabled, rows, overallStatus, loading, error, refresh } = useSyncStatus();
  const [isOpen, setIsOpen] = useState(false);

  if (!enabled) return null;

  return (
    // Mismo estilo Y mismo z-50 que el botón flotante de VendorChatWidget, para
    // que se comporte igual: quede superpuesto (por encima) incluso cuando se
    // abre el detalle de un depósito (ese modal tambien usa z-50, y al montarse
    // este componente despues en AppShell.jsx, gana el empate de stacking).
    // Antes estaba en z-40, mas bajo que el modal, y quedaba tapado por él.
    // Se ubica a la izquierda del botón de chat (right-24 en vez de right-6)
    // para que no se pisen entre ellos.
    <div className="fixed bottom-6 right-24 z-50">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative flex items-center justify-center rounded-full p-3.5 text-white shadow-lg transition-colors ${STATUS_COLORS[overallStatus]} ${
          overallStatus === "ok" ? "hover:bg-emerald-600" : overallStatus === "warning" ? "hover:bg-amber-600" : overallStatus === "critical" ? "hover:bg-rose-600" : "hover:bg-gray-500"
        }`}
        title={STATUS_LABELS[overallStatus]}
        aria-label="Estado de sincronización"
      >
        <RotateCw size={20} className={overallStatus === "critical" ? "animate-pulse" : ""} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-3 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Estado de sincronización
            </h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                title="Actualizar"
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Cerrar"
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {error ? (
              <div className="flex items-start gap-2 px-2 py-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            ) : rows.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
                {loading ? "Consultando..." : "Sin datos de sincronización todavía."}
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={`${row.tabla}-${row.empresa}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_COLORS[row.status]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                      {row.tablaLabel} · {row.empresa}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(row.ultimaCorridaEn)}
                      {row.filasUltimaCorrida ? ` · ${row.filasUltimaCorrida} fila(s)` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
