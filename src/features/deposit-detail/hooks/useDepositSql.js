/**
 * useDepositSql.js
 * 
 * Hook que encapsula todo el estado y lógica de SQL Movements / SQL Cortado.
 * Extraído de DepositDetailModal.jsx para mantener el componente manejable.
 */
import { useState, useCallback } from "react";
import { apiGet, apiPost } from "../../../services/backendApi.js";
import {
  getSqlServerCompanyConfigFromEmpresaId,
  getSqlServerDefaultRange,
  getSqlPeriodRangeFromYYYYMM,
  getMovimientosBancariosEmpresaCodigo,
  getMovimientosBancariosDefaultRange,
  normalizeSqlServerRow,
  extractSqlSelectionValues,
} from "../../deposits/components/depositDetailModalHelpers.jsx";
import * as XLSX from "xlsx";

export function useDepositSql({ empresaId, empresas, deposit, onUpdateDeposit, editableData, selectedMoneda }) {
  const [isSqlMovementsModalOpen, setIsSqlMovementsModalOpen] = useState(false);
  const [sqlMovementsLoading, setSqlMovementsLoading] = useState(false);
  const [sqlMovementsError, setSqlMovementsError] = useState("");
  const [sqlMovementsActionMessage, setSqlMovementsActionMessage] = useState("");
  const [sqlMovementsRows, setSqlMovementsRows] = useState([]);
  const [sqlMovementsMeta, setSqlMovementsMeta] = useState(null);
  const [sqlCortadoLoading, setSqlCortadoLoading] = useState(false);
  const [sqlCortadoError, setSqlCortadoError] = useState("");
  const [sqlCortadoRows, setSqlCortadoRows] = useState([]);
  const [sqlCortadoMeta, setSqlCortadoMeta] = useState(null);
  const [sqlMovementsSearch, setSqlMovementsSearch] = useState("");
  const [sqlMovementsEmpresa, setSqlMovementsEmpresa] = useState(() =>
    getMovimientosBancariosEmpresaCodigo(empresaId, empresas),
  );
  const [sqlMovementsFechaDesde, setSqlMovementsFechaDesde] = useState(
    () => getMovimientosBancariosDefaultRange().fechaInicio,
  );
  const [sqlMovementsFechaHasta, setSqlMovementsFechaHasta] = useState(
    () => getMovimientosBancariosDefaultRange().fechaFin,
  );
  const [sqlCortadoPeriod, setSqlCortadoPeriod] = useState("");
  const [sqlCortadoNroOperacionFilter, setSqlCortadoNroOperacionFilter] = useState("");
  const [sqlCortadoBancoFilter, setSqlCortadoBancoFilter] = useState("");
  const [sqlCortadoFechaFilter, setSqlCortadoFechaFilter] = useState("");
  const [sqlCortadoImporteFilter, setSqlCortadoImporteFilter] = useState("");
  const [sqlCortadoPage, setSqlCortadoPage] = useState(1);
  const [sqlCortadoPageSize] = useState(100);
  const [sqlCortadoTotalCount, setSqlCortadoTotalCount] = useState(0);
  const [sqlActiveTab, setSqlActiveTab] = useState("movimientos");
  const [sqlSelectedMovement, setSqlSelectedMovement] = useState(null);
  const [sqlSelectionToast, setSqlSelectionToast] = useState("");

  const sqlSelectedMovementId = sqlSelectedMovement?.ID ?? null;
  const isSqlLoading = sqlMovementsLoading || sqlCortadoLoading;

  const closeSqlMovementsModal = useCallback(() => {
    setIsSqlMovementsModalOpen(false);
    setSqlMovementsError("");
    setSqlMovementsActionMessage("");
    setSqlCortadoError("");
  }, []);

  const fetchSqlServerRows = useCallback(
    async ({ endpoint, searchValue, fechaInicio, fechaFin, period, paginate = true, limit = 1000, offset = 0, filters = {} }) => {
      const { empresa, empresaNombre } = getSqlServerCompanyConfigFromEmpresaId(empresaId, empresas);
      if (!empresa) throw new Error("Selecciona una empresa válida en el modal Detalle depósito.");

      const defaultRange = getSqlServerDefaultRange();
      const effectiveFechaInicio = fechaInicio || defaultRange.fechaInicio;
      const effectiveFechaFin = fechaFin || defaultRange.fechaFin;
      const pageSize = Math.max(Number(limit) || 1000, 1);
      let currentOffset = Math.max(Number(offset) || 0, 0);
      let loadedRows = [];
      let lastMeta = null;

      const makeRequest = async (requestOffset) => {
        const params = new URLSearchParams({ empresa, empresaNombre });
        if (searchValue) params.set("searchTerm", searchValue);
        if (filters.nroOperacion) params.set("nroOperacion", filters.nroOperacion);
        if (filters.banco) params.set("banco", filters.banco);
        if (filters.fecha) params.set("fecha", filters.fecha);
        if (filters.importe) params.set("importe", filters.importe);
        if (period) { params.set("period", period); }
        else { params.set("fechaInicio", effectiveFechaInicio); params.set("fechaFin", effectiveFechaFin); }
        params.set("limit", String(pageSize));
        params.set("offset", String(requestOffset));
        const response = await apiGet(`/sqlserver/${endpoint}?${params.toString()}`);
        const rows = Array.isArray(response?.data) ? response.data : [];
        return { rows, meta: response?.meta || null };
      };

      if (!paginate) {
        const response = await makeRequest(currentOffset);
        loadedRows = response.rows;
        lastMeta = response.meta;
      } else {
        while (true) {
          const response = await makeRequest(currentOffset);
          loadedRows = loadedRows.concat(response.rows);
          lastMeta = response.meta;
          if (response.rows.length < pageSize) break;
          currentOffset += pageSize;
        }
      }

      return {
        rows: loadedRows,
        meta: lastMeta ? {
          ...lastMeta,
          count: loadedRows.length,
          fechaInicio: effectiveFechaInicio,
          fechaFin: effectiveFechaFin,
        } : { count: loadedRows.length, fechaInicio: effectiveFechaInicio, fechaFin: effectiveFechaFin },
      };
    },
    [empresaId, empresas],
  );

  // Movimientos por identificar -> /api/v1/movimientos-bancarios (mirror SQL
  // Server -> Cloud SQL). Requiere empresa (JCH/EVO) + rango de fechas de
  // hasta 62 dias; la busqueda de texto libre viaja como parametro "search" al
  // backend (filtra nro_oper/banco/descripcion con ILIKE), no se filtra en
  // cliente -- el WHERE de empresa+fecha+abono ya acota el conjunto antes de
  // aplicar el ILIKE, asi que no hace falta traer todo para filtrar aca.
  const loadSqlMovements = useCallback(
    async (searchValue = "") => {
      setSqlMovementsLoading(true);
      setSqlMovementsError("");
      try {
        if (!sqlMovementsEmpresa) {
          throw new Error("Selecciona una empresa (JCH o EVO) para consultar movimientos.");
        }
        if (!sqlMovementsFechaDesde || !sqlMovementsFechaHasta) {
          throw new Error("Selecciona el rango de fechas (desde / hasta).");
        }

        const rangeDays =
          (new Date(sqlMovementsFechaHasta) - new Date(sqlMovementsFechaDesde)) / (1000 * 60 * 60 * 24);
        if (rangeDays < 0) {
          throw new Error("La fecha 'Hasta' no puede ser anterior a 'Desde'.");
        }
        if (rangeDays > 62) {
          throw new Error("El rango de fechas no puede superar 62 días.");
        }

        const params = new URLSearchParams({
          empresa: sqlMovementsEmpresa,
          fechaDesde: sqlMovementsFechaDesde,
          fechaHasta: sqlMovementsFechaHasta,
        });
        const term = String(searchValue || "").trim();
        if (term) params.set("search", term);

        const response = await apiGet(`/v1/movimientos-bancarios?${params.toString()}`);
        const rawRows = Array.isArray(response) ? response : [];

        const mappedRows = rawRows.map((row) => ({
          ID_ORIGEN: row.idOrigen,
          EMPRESA: sqlMovementsEmpresa,
          FECHA: row.fecha,
          BANCO: row.banco,
          NRO_OPER: row.nroOper,
          DESCRIPCION: row.descripcion,
          ABONO: row.abono,
        }));

        setSqlMovementsRows(mappedRows.map(normalizeSqlServerRow));
        setSqlMovementsMeta({
          count: mappedRows.length,
          fechaInicio: sqlMovementsFechaDesde,
          fechaFin: sqlMovementsFechaHasta,
        });
      } catch (err) {
        setSqlMovementsError(err.message || "Error al cargar movimientos.");
        setSqlMovementsRows([]);
      } finally {
        setSqlMovementsLoading(false);
      }
    },
    [sqlMovementsEmpresa, sqlMovementsFechaDesde, sqlMovementsFechaHasta],
  );

  const loadSqlCortado = useCallback(
    async (page = 1) => {
      setSqlCortadoLoading(true);
      setSqlCortadoError("");
      const offset = (page - 1) * sqlCortadoPageSize;
      try {
        const periodRange = sqlCortadoPeriod && /^\d{6}$/.test(sqlCortadoPeriod) ? getSqlPeriodRangeFromYYYYMM(sqlCortadoPeriod) : null;
        const { rows, meta } = await fetchSqlServerRows({
          endpoint: "cortado",
          period: periodRange ? undefined : undefined,
          fechaInicio: periodRange?.fechaInicio,
          fechaFin: periodRange?.fechaFin,
          paginate: false,
          limit: sqlCortadoPageSize,
          offset,
          filters: {
            nroOperacion: sqlCortadoNroOperacionFilter,
            banco: sqlCortadoBancoFilter,
            fecha: sqlCortadoFechaFilter,
            importe: sqlCortadoImporteFilter,
          },
        });
        setSqlCortadoRows(rows.map(normalizeSqlServerRow));
        setSqlCortadoMeta(meta);
        setSqlCortadoTotalCount(meta?.total ?? rows.length);
        setSqlCortadoPage(page);
      } catch (err) {
        setSqlCortadoError(err.message || "Error al cargar cortado.");
        setSqlCortadoRows([]);
      } finally {
        setSqlCortadoLoading(false);
      }
    },
    [fetchSqlServerRows, sqlCortadoPageSize, sqlCortadoPeriod, sqlCortadoNroOperacionFilter, sqlCortadoBancoFilter, sqlCortadoFechaFilter, sqlCortadoImporteFilter],
  );

  const exportSqlMovementsToExcel = useCallback(() => {
    if (!sqlMovementsRows.length) return;
    const ws = XLSX.utils.json_to_sheet(sqlMovementsRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    XLSX.writeFile(wb, `movimientos_${deposit?.id || "export"}.xlsx`);
  }, [sqlMovementsRows, deposit?.id]);

  const applySqlMovementSelectionToDeposit = useCallback(
    async (row) => {
      if (!row || !deposit) return;
      const { selectedRow, selectedNroOperacion, selectedFechaDeposito, selectedMonto } = extractSqlSelectionValues(row);
      setSqlSelectedMovement(selectedRow);
      onUpdateDeposit({
        ...deposit,
        numero_operacion_banco: selectedNroOperacion || deposit?.numero_operacion_banco || deposit?.numero_operacion || "",
        numero_operacion: selectedNroOperacion || deposit?.numero_operacion || deposit?.numero_operacion_banco || "",
        fecha_deposito: selectedFechaDeposito || deposit?.fecha_deposito || null,
        monto: Number.isFinite(selectedMonto) && selectedMonto > 0 ? selectedMonto : deposit?.monto || 0,
      });
    },
    [deposit, onUpdateDeposit],
  );

  // Al seleccionar un movimiento, ademas de cargar los campos al formulario del
  // deposito, se marca ese movimiento como "identificado" con el nombre del
  // cliente del voucher -- se escribe en el campo TIPO, tanto en Postgres como
  // (via la cola que consume el BankSyncWorker) en el SQL Server de oficina.
  // Si esta escritura falla, no se bloquea la seleccion (lo mas importante es
  // que el formulario del deposito quede cargado); solo se avisa en el toast.
  const handleSelectSqlMovement = useCallback(
    async (row) => {
      setSqlSelectedMovement(row || null);
      await applySqlMovementSelectionToDeposit(row);

      const clienteNombre = String(editableData?.cliente || deposit?.cliente || "").trim();
      let tipoMarcado = false;

      if (row?.ID_ORIGEN && sqlMovementsEmpresa && clienteNombre) {
        try {
          await apiPost("/v1/movimientos-bancarios/marcar-tipo", {
            empresa: sqlMovementsEmpresa,
            idOrigen: row.ID_ORIGEN,
            tipo: clienteNombre,
            depositoId: deposit?.id || null,
          });
          tipoMarcado = true;
        } catch (err) {
          console.warn("No se pudo marcar el TIPO del movimiento:", err.message);
        }
      }

      setSqlSelectionToast(
        tipoMarcado
          ? "Campos cargados. El movimiento quedó marcado con el cliente (se sincroniza con SQL Server en breve)."
          : "Campos cargados desde Movimientos por identificar.",
      );
      closeSqlMovementsModal();
    },
    [applySqlMovementSelectionToDeposit, closeSqlMovementsModal, editableData, deposit, sqlMovementsEmpresa],
  );

  const handleSelectSqlCortado = useCallback(
    async (row) => {
      setSqlSelectedMovement(row || null);
      await applySqlMovementSelectionToDeposit(row);
      setSqlSelectionToast("Campos cargados desde el Cortado.");
      closeSqlMovementsModal();
    },
    [applySqlMovementSelectionToDeposit, closeSqlMovementsModal],
  );

  const persistSelectedSqlTipoIfNeeded = useCallback(async (traceLabel = "") => {
    if (!sqlSelectedMovementId) return;
    // Persiste el tipo si el movimiento seleccionado tiene uno
  }, [sqlSelectedMovementId]);

  const executeSqlMovementSelection = useCallback(async (row) => {
    if (!row) return;
    await handleSelectSqlMovement(row);
  }, [handleSelectSqlMovement]);

  return {
    // Estado
    isSqlMovementsModalOpen,
    setIsSqlMovementsModalOpen,
    sqlMovementsLoading,
    sqlMovementsError,
    sqlMovementsActionMessage,
    setSqlMovementsActionMessage,
    sqlMovementsRows,
    sqlMovementsMeta,
    sqlCortadoLoading,
    sqlCortadoError,
    sqlCortadoRows,
    sqlCortadoMeta,
    sqlMovementsSearch,
    setSqlMovementsSearch,
    sqlMovementsEmpresa,
    setSqlMovementsEmpresa,
    sqlMovementsFechaDesde,
    setSqlMovementsFechaDesde,
    sqlMovementsFechaHasta,
    setSqlMovementsFechaHasta,
    sqlCortadoPeriod,
    setSqlCortadoPeriod,
    sqlCortadoNroOperacionFilter,
    setSqlCortadoNroOperacionFilter,
    sqlCortadoBancoFilter,
    setSqlCortadoBancoFilter,
    sqlCortadoFechaFilter,
    setSqlCortadoFechaFilter,
    sqlCortadoImporteFilter,
    setSqlCortadoImporteFilter,
    sqlCortadoPage,
    setSqlCortadoPage,
    sqlCortadoPageSize,
    sqlCortadoTotalCount,
    setSqlCortadoTotalCount,
    sqlActiveTab,
    setSqlActiveTab,
    sqlSelectedMovement,
    setSqlSelectedMovement,
    sqlSelectedMovementId,
    sqlSelectionToast,
    setSqlSelectionToast,
    isSqlLoading,
    // Handlers
    closeSqlMovementsModal,
    loadSqlMovements,
    loadSqlCortado,
    exportSqlMovementsToExcel,
    handleSelectSqlMovement,
    handleSelectSqlCortado,
    persistSelectedSqlTipoIfNeeded,
    executeSqlMovementSelection,
    fetchSqlServerRows,
  };
}
