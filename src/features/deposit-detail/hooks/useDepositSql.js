/**
 * useDepositSql.js
 * 
 * Hook que encapsula todo el estado y lógica de SQL Movements / SQL Cortado.
 * Extraído de DepositDetailModal.jsx para mantener el componente manejable.
 */
import { useState, useCallback } from "react";
import { apiGet, apiPost } from "../../../services/backendApi.js";
import {
  getSqlPeriodRangeFromYYYYMM,
  getMovimientosBancariosEmpresaCodigo,
  getMovimientosBancariosDefaultRange,
  normalizeSqlServerRow,
  extractSqlSelectionValues,
} from "../../deposits/components/depositDetailModalHelpers.jsx";
import * as XLSX from "xlsx";

export function useDepositSql({ empresaId, empresas, deposit, editableData, setEditableData, selectedMoneda }) {
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

  // Movimientos por identificar -> /api/v1/movimientos-bancarios/por-identificar
  // (mirror SQL Server -> Cloud SQL + conciliacion contra RegistrosConcar +
  // match con depositos por CUO). Requiere empresa (JCH/EVO) + rango de fechas
  // de hasta 62 dias; la busqueda de texto libre viaja como parametro "search"
  // al backend (filtra nro_oper/banco/sucursal/contacto/ruc/observacion con
  // ILIKE), no se filtra en cliente.
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
          limit: "500",
        });
        const term = String(searchValue || "").trim();
        if (term) params.set("search", term);

        const response = await apiGet(`/v1/movimientos-bancarios/por-identificar?${params.toString()}`);
        const rawRows = Array.isArray(response) ? response : [];

        const mappedRows = rawRows.map((row) => ({
          ID_ORIGEN: row.idOrigen,
          EMPRESA: sqlMovementsEmpresa,
          CUO: row.cuo,
          FECHA: row.fecha,
          BANCO: row.banco,
          NRO_OPER: row.nroOper,
          DESCRIPCION: row.descripcion,
          ABONO: row.abono,
          CARGO: row.cargo,
          REG: row.reg,
          DIF: row.dif,
          REGISTRO: row.registro,
          Sucursal: row.sucursal,
          Contacto: row.contacto,
          TelefonoContacto: row.telefonoContacto,
          ValidadoPor: row.validadoPor,
          Observacion: row.observacion,
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

  // Cortado vs RegistrosConcar -> /api/v1/movimientos-bancarios/cortado
  // (mismo mirror movimientos_bancarios, cruzado contra registros_concar por
  // CUO/MCUO, replicando la logica del reporte del sistema anterior). Antes
  // esto pegaba a "/sqlserver/cortado", un endpoint que nunca existio en el
  // backend real -- por eso siempre devolvia "sin registros".
  const loadSqlCortado = useCallback(
    async (page = 1) => {
      setSqlCortadoLoading(true);
      setSqlCortadoError("");
      try {
        if (!/^\d{6}$/.test(sqlCortadoPeriod || "")) {
          throw new Error("Ingresa el periodo del reporte en formato YYYYMM (ej. 202606).");
        }
        const empresa = getMovimientosBancariosEmpresaCodigo(empresaId, empresas);
        if (!empresa) {
          throw new Error("Selecciona una empresa válida en el modal Detalle depósito.");
        }
        const periodRange = getSqlPeriodRangeFromYYYYMM(sqlCortadoPeriod);
        if (!periodRange) {
          throw new Error("Periodo invalido.");
        }

        const offset = (page - 1) * sqlCortadoPageSize;
        const params = new URLSearchParams({
          empresa,
          fechaDesde: periodRange.fechaInicio,
          fechaHasta: periodRange.fechaFin,
          offset: String(offset),
          limit: String(sqlCortadoPageSize),
        });
        if (sqlCortadoNroOperacionFilter.trim()) params.set("nroOperacion", sqlCortadoNroOperacionFilter.trim());
        if (sqlCortadoBancoFilter.trim()) params.set("banco", sqlCortadoBancoFilter.trim());
        if (sqlCortadoFechaFilter) params.set("fecha", sqlCortadoFechaFilter);
        if (sqlCortadoImporteFilter !== "" && !Number.isNaN(Number(sqlCortadoImporteFilter))) {
          params.set("importe", String(Number(sqlCortadoImporteFilter)));
        }

        const response = await apiGet(`/v1/movimientos-bancarios/cortado?${params.toString()}`);
        const rawRows = Array.isArray(response?.rows) ? response.rows : [];
        const totalCount = Number(response?.totalCount) || 0;

        const mappedRows = rawRows.map((row) => ({
          ID: row.idOrigen,
          CUO: row.cuo,
          PERIODO: row.periodo,
          BANCO: row.banco,
          FECHA: row.fecha,
          DESCRIPCION: row.descripcion,
          NRO_OPER: row.nroOper,
          CARGO: row.cargo,
          ABONO: row.abono,
          SD: row.sd,
          COMP: row.comp,
          TIPO: row.tipo,
          DOC: row.doc,
          AREA: row.area,
          Observacion: row.observacion,
          REGISTRO: row.registro,
          GLOSA: row.glosa,
          REG: row.reg,
          DIF: row.dif,
        }));

        setSqlCortadoRows(mappedRows.map(normalizeSqlServerRow));
        setSqlCortadoMeta({ count: mappedRows.length, total: totalCount });
        setSqlCortadoTotalCount(totalCount);
        setSqlCortadoPage(page);
      } catch (err) {
        setSqlCortadoError(err.message || "Error al cargar cortado.");
        setSqlCortadoRows([]);
        setSqlCortadoTotalCount(0);
      } finally {
        setSqlCortadoLoading(false);
      }
    },
    [
      empresaId,
      empresas,
      sqlCortadoPageSize,
      sqlCortadoPeriod,
      sqlCortadoNroOperacionFilter,
      sqlCortadoBancoFilter,
      sqlCortadoFechaFilter,
      sqlCortadoImporteFilter,
    ],
  );

  const exportSqlMovementsToExcel = useCallback(() => {
    if (!sqlMovementsRows.length) return;
    const ws = XLSX.utils.json_to_sheet(sqlMovementsRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    XLSX.writeFile(wb, `movimientos_${deposit?.id || "export"}.xlsx`);
  }, [sqlMovementsRows, deposit?.id]);

  // Antes el boton "Exportar Excel" del tab Cortado exportaba por error las
  // filas del otro tab (sqlMovementsRows); esta funcion exporta las suyas.
  const exportSqlCortadoToExcel = useCallback(() => {
    if (!sqlCortadoRows.length) return;
    const ws = XLSX.utils.json_to_sheet(sqlCortadoRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cortado");
    XLSX.writeFile(wb, `cortado_${sqlCortadoPeriod || deposit?.id || "export"}.xlsx`);
  }, [sqlCortadoRows, sqlCortadoPeriod, deposit?.id]);

  // FIX: antes esto llamaba a onUpdateDeposit(...) SIN { skipPersist: true },
  // lo que disparaba un PUT real al backend y persistia el numero de operacion
  // en la BD apenas se hacia clic en "Seleccionar" -- salteando la revision de
  // finanzas (confirmar/rechazar). Y encima el formulario abierto (editableData,
  // gobernado por useDepositForm) nunca se refrescaba con ese cambio, porque ese
  // hook solo hidrata estos campos la primera vez que carga el deposito -- el
  // numero quedaba guardado "por atras" sin que se viera en pantalla.
  // Ahora solo se actualiza el formulario local (setEditableData); el guardado
  // real recien ocurre al Confirmar/Rechazar, que ya lee estos mismos campos
  // de editableData (ver buildEditableFieldsForRequest en useDepositActions.js).
  const applySqlMovementSelectionToDeposit = useCallback(
    (row) => {
      if (!row) return;
      const { selectedRow, selectedNroOperacion, selectedFechaDeposito, selectedMonto } = extractSqlSelectionValues(row);
      setSqlSelectedMovement(selectedRow);
      setEditableData((prev) => ({
        ...prev,
        numero_operacion_banco: selectedNroOperacion || prev.numero_operacion_banco,
        fecha_deposito: selectedFechaDeposito || prev.fecha_deposito,
        monto: Number.isFinite(selectedMonto) && selectedMonto > 0 ? selectedMonto : prev.monto,
      }));
    },
    [setEditableData],
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
    exportSqlCortadoToExcel,
    handleSelectSqlMovement,
    handleSelectSqlCortado,
    persistSelectedSqlTipoIfNeeded,
    executeSqlMovementSelection,
  };
}
