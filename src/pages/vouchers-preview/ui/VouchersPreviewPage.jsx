import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, FileText, Loader2, XCircle } from "lucide-react";
import { fetchDepositsByDate, fetchDepositsByRange } from "../../../features/deposits/api/depositsApi.js";
import { toLocalISOString } from "../../../utils/dateFormatters.js";
import VoucherGallery from "./VoucherGallery.jsx";
import VoucherLightbox from "./VoucherLightbox.jsx";

// No se debe poder buscar mas de 6 dias hacia atras en un solo rango, para
// no sobrecargar la grilla de miniaturas (ver pedido original: "no debe
// sobrepasar mas de 6 dias para no sobrecargar de tanta informacion").
const MAX_RANGO_DIAS = 6;

function addDays(dateStr, dias) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

function diffDays(desdeStr, hastaStr) {
  const [y1, m1, d1] = desdeStr.split("-").map(Number);
  const [y2, m2, d2] = hastaStr.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

// Pantalla de revision visual rapida de vouchers: por defecto solo los del
// dia de hoy, con filtro de rango extensible pero topado a MAX_RANGO_DIAS.
// No toca el estado compartido del dashboard (dashboard.deposits) a
// proposito -- Kanban y Tabla ya comparten esa selección de fecha entre si,
// y esta pantalla es una vista de consulta aparte que no deberia pisarla.
const VouchersPreviewPage = ({ empresas = [], bancos = [], sucursales = [], onSelectDate }) => {
  const hoy = useMemo(() => toLocalISOString(new Date()), []);
  const navigate = useNavigate();

  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfCount, setPdfCount] = useState(0);
  const [lightboxDeposit, setLightboxDeposit] = useState(null);

  const cargar = useCallback(async (desdeVal, hastaVal) => {
    setLoading(true);
    setError("");
    try {
      const data =
        hastaVal && hastaVal !== desdeVal
          ? await fetchDepositsByRange(desdeVal, hastaVal)
          : await fetchDepositsByDate(desdeVal);
      setDeposits(data);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los vouchers.");
      setDeposits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar(hoy, hoy);
    // Solo al montar: carga inicial del dia de hoy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarRango = (nuevoDesde, nuevoHasta) => {
    setDesde(nuevoDesde);
    setHasta(nuevoHasta);
    cargar(nuevoDesde, nuevoHasta);
  };

  const handleDesdeChange = (value) => {
    if (!value) return;
    // Si el rango actual ya no tiene sentido con la nueva fecha "desde"
    // (hasta quedo antes, o el rango supera el tope), se reinicia hasta=desde.
    let nuevaHasta = hasta;
    if (diffDays(value, hasta) < 0 || diffDays(value, hasta) > MAX_RANGO_DIAS) {
      nuevaHasta = value;
    }
    aplicarRango(value, nuevaHasta);
  };

  const handleHastaChange = (value) => {
    if (!value) return;
    let clamped = value > hoy ? hoy : value;
    if (diffDays(desde, clamped) > MAX_RANGO_DIAS) clamped = addDays(desde, MAX_RANGO_DIAS);
    if (diffDays(desde, clamped) < 0) clamped = desde;
    aplicarRango(desde, clamped);
  };

  const aplicarPreset = (diasAtras) => {
    const nuevoDesde = diasAtras === 0 ? hoy : addDays(hoy, -diasAtras);
    aplicarRango(nuevoDesde, hoy);
  };

  const depositsEnriquecidos = useMemo(() => {
    const empresasById = new Map(empresas.map((e) => [String(e.id), e]));
    const bancosById = new Map(bancos.map((b) => [String(b.id), b]));
    const sucursalesById = new Map(sucursales.map((s) => [String(s.id), s]));

    return deposits.map((d) => ({
      ...d,
      empresa: d.empresa || empresasById.get(String(d.empresa_id)) || null,
      banco: d.banco || bancosById.get(String(d.banco_id)) || null,
      sucursal: d.sucursal || sucursalesById.get(String(d.sucursal_id)) || null,
    }));
  }, [deposits, empresas, bancos, sucursales]);

  const irATablaConEstosPdf = () => {
    onSelectDate?.(desde);
    navigate("/table");
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vista Previa de Vouchers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Revisión visual rápida de los comprobantes recibidos. Máximo {MAX_RANGO_DIAS} días de rango.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => aplicarPreset(0)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => aplicarPreset(3)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Últimos 3 días
          </button>
          <button
            type="button"
            onClick={() => aplicarPreset(MAX_RANGO_DIAS)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Últimos {MAX_RANGO_DIAS} días
          </button>

          <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-600">
            <CalendarDays size={14} className="text-gray-400" />
            <input
              type="date"
              value={desde}
              max={hoy}
              onChange={(e) => handleDesdeChange(e.target.value)}
              className="bg-transparent text-sm text-gray-700 outline-none dark:text-gray-200"
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              value={hasta}
              min={desde}
              max={hoy}
              onChange={(e) => handleHastaChange(e.target.value)}
              className="bg-transparent text-sm text-gray-700 outline-none dark:text-gray-200"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {pdfCount > 0 && !loading && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="flex items-center gap-2">
            <FileText size={16} />
            {pdfCount} {pdfCount === 1 ? "voucher en PDF no se muestra" : "vouchers en PDF no se muestran"} aquí.
          </span>
          <button
            type="button"
            onClick={irATablaConEstosPdf}
            className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
          >
            Verlos en la vista de tabla
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Cargando vouchers...
        </div>
      ) : (
        <VoucherGallery
          deposits={depositsEnriquecidos}
          onOpen={setLightboxDeposit}
          onPdfCountChange={setPdfCount}
        />
      )}

      <VoucherLightbox deposit={lightboxDeposit} onClose={() => setLightboxDeposit(null)} />
    </div>
  );
};

export default VouchersPreviewPage;
