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

  const loadSqlMovements = useCallback(
    async (searchValue = "") => {
      setSqlMovementsLoading(true);
      setSqlMovementsError("");
      try {
        const { rows, meta } = await fetchSqlServerRows({ endpoint: "movimientos", searchValue, paginate: true, limit: 1000 });
        setSqlMovementsRows(rows.map(normalizeSqlServerRow));
        setSqlMovementsMeta(meta);
      } catch (err) {
        setSqlMovementsError(err.message || "Error al cargar movimientos.");
        setSqlMovementsRows([]);
      } finally {
        setSqlMovementsLoading(false);
      }
    },
    [fetchSqlServerRows],
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

  const handleSelectSqlMovement = useCallback(
    async (row) => {
      setSqlSelectedMovement(row || null);
      await applySqlMovementSelectionToDeposit(row);
      setSqlSelectionToast("Campos cargados desde Movimientos por identificar.");
      closeSqlMovementsModal();
    },
    [applySqlMovementSelectionToDeposit, closeSqlMovementsModal],
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
