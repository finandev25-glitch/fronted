import { useContext, useEffect, useRef } from "react";
import { AuthContext } from "../../../contexts/AuthContext.jsx";
import { DEPOSIT_FULL_QUERY } from "../../../constants/depositQuery";
import { useDepositAlerts } from "./useDepositAlerts.js";
import { useDepositCatalogs } from "./useDepositCatalogs.js";
import { useDepositRecords } from "./useDepositRecords.js";
import { useRealtimeDeposits } from "./useRealtimeDeposits.js";
import { useVoucherPanel } from "./useVoucherPanel.js";

export function useDepositDashboard() {
  const { currentUser, users } = useContext(AuthContext);
  const currentUserRef = useRef(currentUser);
  const isAuthenticated = !!currentUser;

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const catalogs = useDepositCatalogs();
  const voucherPanel = useVoucherPanel();

  const records = useDepositRecords({
    currentUser,
    users,
    personal: catalogs.personal,
    bancos: catalogs.bancos,
    empresas: catalogs.empresas,
    sucursales: catalogs.sucursales,
    isAuthenticated,
    showPendingDepositNotification: alertsPlaceholder,
  });

  const alerts = useDepositAlerts({
    currentUserRef,
    pendingWorkloadCount: records.pendingWorkloadCount,
  });

  function alertsPlaceholder() {
    return false;
  }

  const realtime = useRealtimeDeposits(
    currentUser,
    records.handleRealtimeInsert,
    records.handleRealtimeUpdate,
    records.handleRealtimeDelete,
    DEPOSIT_FULL_QUERY,
    records.refreshDeposits
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const intervalDelay = realtime.realtimeStatus === "SUBSCRIBED" ? 5 * 60 * 1000 : 60000;
    const refreshTimer = setInterval(() => {
      records.refreshDeposits();
    }, intervalDelay);

    return () => {
      clearInterval(refreshTimer);
    };
  }, [currentUser, records.refreshDeposits, realtime.realtimeStatus]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    (async () => {
      try {
        await catalogs.fetchData();
      } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
      }
    })();
  }, [catalogs.fetchData, currentUser]);

  useEffect(() => {
    void alerts.triggerWorkloadAlarm();
  }, [alerts.triggerWorkloadAlarm, records.pendingWorkloadCount]);

  // Notificación roja cuando la columna "Pendiente" de hoy supera 3 cards.
  // notifyNewPendingIfNeeded aplica la condición (>3), el episodio y el cooldown.
  useEffect(() => {
    void alerts.notifyNewPendingIfNeeded(records.pendientesHoyCount);
  }, [alerts.notifyNewPendingIfNeeded, records.pendientesHoyCount]);

  // Re-verificar al volver el foco a la pestaña: cubre el caso de que el usuario
  // recién active el permiso de notificaciones teniendo ya >3 pendientes (sin
  // esto habría que esperar a que cambie el conteo).
  const pendientesHoyCountRef = useRef(records.pendientesHoyCount);
  useEffect(() => {
    pendientesHoyCountRef.current = records.pendientesHoyCount;
  }, [records.pendientesHoyCount]);

  useEffect(() => {
    const recheck = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void alerts.notifyNewPendingIfNeeded(pendientesHoyCountRef.current);
      }
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [alerts.notifyNewPendingIfNeeded]);

  return {
    bancos: catalogs.bancos,
    empresas: catalogs.empresas,
    cuentas: catalogs.cuentas,
    sucursales: catalogs.sucursales,
    deposits: records.deposits,
    personal: catalogs.personal,
    appDataLoading: catalogs.appDataLoading,
    appDataError: catalogs.appDataError,
    realtimeActivity: records.realtimeActivity,
    realtimeStatus: realtime.realtimeStatus,
    realtimeErrors: realtime.realtimeErrors,
    workloadAlarmActive: alerts.workloadAlarmActive,
    workloadThreshold: alerts.workloadThreshold,
    pendingWorkloadCount: records.pendingWorkloadCount,
    replacementRequestState: alerts.replacementRequestState,
    voucherPanelState: voucherPanel.voucherPanelState,
    currentSelectedDate: records.currentSelectedDate,
    depositsWithFullData: records.depositsWithFullData,
    isAuthenticated,
    fetchData: catalogs.fetchData,
    fetchBancosData: catalogs.fetchBancosData,
    fetchEmpresasData: catalogs.fetchEmpresasData,
    fetchCuentasData: catalogs.fetchCuentasData,
    fetchSucursalesData: catalogs.fetchSucursalesData,
    fetchPersonalData: catalogs.fetchPersonalData,
    refreshDeposits: records.refreshDeposits,
    fetchDepositsByDate: records.fetchDepositsByDate,
    fetchAllDeposits: records.fetchAllDeposits,
    fetchDepositsByPeriod: records.fetchDepositsByPeriod,
    handleSelectedDateChange: records.handleSelectedDateChange,
    handleSelectDate: records.handleSelectDate,
    handleOpenVoucherWindow: voucherPanel.handleOpenVoucherWindow,
    handleCloseVoucherPanel: voucherPanel.handleCloseVoucherPanel,
    handleAddBanco: catalogs.handleAddBanco,
    handleUpdateBanco: catalogs.handleUpdateBanco,
    handleDeleteBanco: catalogs.handleDeleteBanco,
    handleAddEmpresa: catalogs.handleAddEmpresa,
    handleUpdateEmpresa: catalogs.handleUpdateEmpresa,
    handleAddCuenta: catalogs.handleAddCuenta,
    handleBatchAddCuentas: catalogs.handleBatchAddCuentas,
    handleUpdateCuenta: catalogs.handleUpdateCuenta,
    handleDeleteCuenta: catalogs.handleDeleteCuenta,
    handleAddSucursal: catalogs.handleAddSucursal,
    handleUpdateSucursal: catalogs.handleUpdateSucursal,
    handleAddPersonalToSucursal: catalogs.handleAddPersonalToSucursal,
    handleRemovePersonalFromSucursal: catalogs.handleRemovePersonalFromSucursal,
    handleUpdatePersonal: catalogs.handleUpdatePersonal,
    handleUpdateDeposit: records.handleUpdateDeposit,
    handleTakeDepositForValidation: records.handleTakeDepositForValidation,
    handleUnlockDeposit: records.handleUnlockDeposit,
    triggerWorkloadAlarm: alerts.triggerWorkloadAlarm,
    requestReplacementHelp: alerts.requestReplacementHelp,
  };
}

export default useDepositDashboard;
