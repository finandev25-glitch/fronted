import React, { useContext, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AuthContext } from "../contexts/AuthContext.jsx";
import {
  fetchRegularizacionesHistorial,
  financeRegularizeImage,
  getRegularizacionImagenAnteriorUrl,
  getRegularizacionImagenNuevaUrl,
} from "../features/deposits/api/depositsApi.js";
import RegularizeImageModal from "../features/deposits/components/RegularizeImageModal.jsx";
import { useToast } from "./ToastProvider.jsx";
import VoucherModal from "./VoucherModal.jsx";
import { Download, Search, RefreshCw, History, Image as ImageIcon, UploadCloud } from "lucide-react";

const ACCION_LABELS = {
  marcado: "Pendiente",
  resuelto: "Resuelto",
  desmarcado: "Desmarcado",
};

const ACCION_STYLES = {
  marcado: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  resuelto: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  desmarcado: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

// "Fecha" (createdAt) es un timestamp completo con offset -- toLocaleString
// ya convierte al huso del navegador correctamente, solo se le quitan las
// opciones de hora/minuto para mostrar nada más el día.
function formatDateTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Fecha del depósito (DateOnly del backend, "yyyy-MM-dd") -- sin componente
// de hora, se formatea a mano en vez de con new Date() para no arrastrar
// problemas de huso horario (new Date("2026-09-18") se interpreta en UTC y
// puede mostrar el día anterior según la zona del navegador).
function formatDateOnly(isoString) {
  if (!isoString) return "-";
  try {
    const [year, month, day] = isoString.split("T")[0].split("-");
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
}

function formatMonto(monto) {
  const value = Number(monto);
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RegularizacionesHistorialView = ({ empresas = [] }) => {
  const { currentUser } = useContext(AuthContext);
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterAccion, setFilterAccion] = useState("all");
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [zoomImage, setZoomImage] = useState(null);
  const [uploadRow, setUploadRow] = useState(null);

  const userRol = currentUser?.user_rol || "";
  const canView = userRol === "finanzas" || userRol === "admin";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (desde) params.desde = `${desde}T00:00:00.000Z`;
      if (hasta) params.hasta = `${hasta}T23:59:59.999Z`;
      if (filterAccion !== "all") params.accion = filterAccion;
      if (filterEmpresa !== "all") params.empresaId = filterEmpresa;
      const data = await fetchRegularizacionesHistorial(params);
      setRows(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, desde, hasta, filterAccion, filterEmpresa]);

  // Sube la imagen nueva directo desde esta vista (antes solo se podía desde
  // Tabla). Solo se ofrece el botón para filas en estado "marcado" -- el
  // backend exige que el depósito esté pendienteRegularizar, y esta vista ya
  // solo lo habilita en ese caso, así que siempre va a funcionar.
  const handleSubmitRegularizeImage = async (imagenBase64) => {
    if (!uploadRow) return;
    try {
      await financeRegularizeImage(uploadRow.depositoId, imagenBase64);
      toast.success("Voucher actualizado correctamente.");
      setUploadRow(null);
      await load();
    } catch (err) {
      toast.error(`No se pudo cargar la imagen: ${err.message}`);
    }
  };

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const numero = String(row.numeroOperacion || "").toLowerCase();
      const cliente = String(row.cliente || "").toLowerCase();
      const usuario = String(row.usuarioNombre || "").toLowerCase();
      return numero.includes(term) || cliente.includes(term) || usuario.includes(term);
    });
  }, [rows, searchTerm]);

  const handleExportExcel = () => {
    const dataToExport = filteredRows.map((row) => ({
      Fecha: formatDateTime(row.createdAt),
      "Fecha Depósito": formatDateOnly(row.fechaDeposito),
      "Nro. Operación": row.numeroOperacion || "",
      Cliente: row.cliente || "",
      Empresa: row.empresaNombre || "",
      Sucursal: row.sucursalNombre || "",
      Monto: formatMonto(row.monto),
      Moneda: row.moneda || "",
      Anexo: row.anexo || "",
      Estado: ACCION_LABELS[row.accion] || row.accion || "",
      Usuario: row.usuarioNombre || "",
      Motivo: row.motivo || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Regularizaciones");
    XLSX.writeFile(workbook, "historial_regularizaciones.xlsx");
  };

  if (!canView) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-gray-500 dark:text-gray-400">
        No tienes permisos para ver esta sección.
      </div>
    );
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <History size={20} />
            Historial de Regularizaciones
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Un registro por depósito con su estado actual de regularización.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center space-x-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download size={14} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[220px] relative">
          <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por Nro. operación, cliente o usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
          />
        </div>

        <select
          value={filterAccion}
          onChange={(e) => setFilterAccion(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
        >
          <option value="all">Todos los estados</option>
          <option value="marcado">Pendiente</option>
          <option value="resuelto">Resuelto</option>
          <option value="desmarcado">Desmarcado</option>
        </select>

        <select
          value={filterEmpresa}
          onChange={(e) => setFilterEmpresa(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
        >
          <option value="all">Todas las empresas</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha Depósito</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Nro. Operación</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sucursal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Anexo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Vouchers</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cargar voucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDateOnly(row.fechaDeposito)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.numeroOperacion || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.cliente || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.empresaNombre || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.sucursalNombre || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {row.moneda === "USD" ? "$" : "S/"} {formatMonto(row.monto)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.anexo || "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ACCION_STYLES[row.accion] || ACCION_STYLES.desmarcado}`}>
                      {ACCION_LABELS[row.accion] || row.accion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.usuarioNombre || "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.imagenAnterior && row.imagenNueva ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setZoomImage({
                              url: getRegularizacionImagenAnteriorUrl(row.id),
                              isPdf: (row.imagenAnterior || "").toLowerCase().endsWith(".pdf"),
                            })
                          }
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                          title="Ver voucher anterior"
                        >
                          <ImageIcon size={11} />
                          Anterior
                        </button>
                        <button
                          onClick={() =>
                            setZoomImage({
                              url: getRegularizacionImagenNuevaUrl(row.id),
                              isPdf: (row.imagenNueva || "").toLowerCase().endsWith(".pdf"),
                            })
                          }
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          title="Ver voucher nuevo"
                        >
                          <ImageIcon size={11} />
                          Nuevo
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => setUploadRow(row)}
                      disabled={row.accion !== "marcado"}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent dark:disabled:border-gray-700 dark:disabled:text-gray-600"
                      title={
                        row.accion === "marcado"
                          ? "Cargar voucher nuevo"
                          : "Solo disponible para depósitos pendientes"
                      }
                    >
                      <UploadCloud size={11} />
                      Cargar
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {zoomImage && (
        <VoucherModal
          imageUrl={zoomImage.url}
          isPdf={zoomImage.isPdf}
          onClose={() => setZoomImage(null)}
        />
      )}

      {uploadRow && (
        <RegularizeImageModal
          deposit={{ numero_operacion_banco: uploadRow.numeroOperacion }}
          onClose={() => setUploadRow(null)}
          onSubmit={handleSubmitRegularizeImage}
        />
      )}
    </div>
  );
};

export default RegularizacionesHistorialView;
