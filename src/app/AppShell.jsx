import { useContext, useEffect, useMemo, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import FloatingDepositMetaOverlay from "../components/FloatingDepositMetaOverlay.jsx";
import MobileHeader from "../components/MobileHeader.jsx";
import Sidebar from "../components/Sidebar";
import VoucherExtensionPanel from "../components/VoucherExtensionPanel.jsx";
import { AuthContext } from "../features/auth/context/AuthContext.jsx";
import { useDepositDashboard } from "../features/deposits/hooks/useDepositDashboard.js";
import AuthPage from "../features/auth/pages/AuthPage.jsx";
import PendingApproval from "../features/auth/pages/PendingApproval.jsx";
import AppRoutes from "./AppRoutes.jsx";

export function AppShell({ uiMode = "default" }) {
  const isExtensionMode = uiMode === "extension";
  const { currentUser, loading, refreshUsers } = useContext(AuthContext);
  const location = useLocation();
  const dashboard = useDepositDashboard();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isExtensionMode);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const detailPresentationMode = isExtensionMode || isMobileViewport ? "compact" : "default";

  const attendanceSummary = useMemo(() => {
    if (!dashboard.currentSelectedDate) return [];

    const counts = new Map();

    dashboard.depositsWithFullData.forEach((deposit) => {
      if (!deposit || deposit.fecha_solo_date !== dashboard.currentSelectedDate) {
        return;
      }

      if (deposit.estado === "recibido") {
        return;
      }

      const assignedUser = String(
        deposit.validado_por_usuario?.nombre ||
          deposit.validado_por_nombre ||
          deposit.validado_por ||
          "Sin asignar",
      ).trim();

      if (!assignedUser) {
        return;
      }

      counts.set(assignedUser, (counts.get(assignedUser) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  }, [dashboard.currentSelectedDate, dashboard.depositsWithFullData]);

  useEffect(() => {
    if (!currentUser) return;

    const shouldRefreshOnEnter = [
      "/usuarios",
      "/bancos",
      "/gestion-bancos",
      "/gestion-empresas",
    ].includes(location.pathname);

    if (!shouldRefreshOnEnter) return;

    const refreshModuleData = async () => {
      try {
        if (location.pathname === "/usuarios") {
          await refreshUsers?.();
          return;
        }

        if (location.pathname === "/bancos") {
          await Promise.all([
            dashboard.fetchBancosData?.(),
            dashboard.fetchEmpresasData?.(),
            dashboard.fetchCuentasData?.(),
          ]);
          return;
        }

        if (location.pathname === "/gestion-bancos") {
          await dashboard.fetchBancosData?.();
          return;
        }

        if (location.pathname === "/gestion-empresas") {
          await dashboard.fetchEmpresasData?.();
        }
      } catch (error) {
        console.warn("No se pudo refrescar el modulo al ingresar:", error);
      }
    };

    refreshModuleData();
  }, [
    currentUser,
    dashboard.fetchBancosData,
    dashboard.fetchCuentasData,
    dashboard.fetchEmpresasData,
    location.pathname,
    refreshUsers,
  ]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="ml-4 text-lg text-gray-700 dark:text-gray-300">Inicializando aplicacion...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  if (currentUser.estado === "inactivo") {
    return <PendingApproval />;
  }

  if (dashboard.appDataLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="ml-4 text-lg text-gray-700 dark:text-gray-300">Cargando datos...</p>
      </div>
    );
  }

  if (dashboard.appDataError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-8">
        <div className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Error Critico</h3>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">{dashboard.appDataError}</p>
          <p className="mt-4 text-sm text-gray-500">
            Intenta recargar la pagina. Si el problema persiste, contacta a soporte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen overflow-hidden ${
        isExtensionMode ? "bg-slate-100 p-0 dark:bg-gray-950" : "bg-gray-50 dark:bg-gray-950"
      }`}
    >
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        compactMode={isExtensionMode}
        selectedDate={dashboard.currentSelectedDate}
        attendanceSummary={attendanceSummary}
        workloadAlarmActive={dashboard.workloadAlarmActive}
        pendingWorkloadCount={dashboard.pendingWorkloadCount}
        workloadThreshold={dashboard.workloadThreshold}
        onRequestReplacementHelp={dashboard.requestReplacementHelp}
        replacementRequestState={dashboard.replacementRequestState}
      />
      <div className={`flex min-w-0 flex-1 flex-col ${isExtensionMode ? "overflow-hidden bg-white dark:bg-gray-900" : ""}`}>
        <MobileHeader
          onMenuClick={() => setIsMobileMenuOpen(true)}
          connectionStatus={{
            isAuthenticated: dashboard.isAuthenticated,
            realtimeStatus: dashboard.realtimeStatus,
            realtimeErrors: dashboard.realtimeErrors,
          }}
          compactMode={isExtensionMode}
          realtimeActivity={dashboard.realtimeActivity}
          selectedDate={dashboard.currentSelectedDate}
          attendanceSummary={attendanceSummary}
          workloadAlarmActive={dashboard.workloadAlarmActive}
          pendingWorkloadCount={dashboard.pendingWorkloadCount}
          workloadThreshold={dashboard.workloadThreshold}
          onRequestReplacementHelp={dashboard.requestReplacementHelp}
          replacementRequestState={dashboard.replacementRequestState}
        />
        <main className="flex-1 overflow-y-auto">
          <AppRoutes
            currentUser={currentUser}
            dashboard={dashboard}
            detailPresentationMode={detailPresentationMode}
            isExtensionMode={isExtensionMode}
          />
        </main>
      </div>

      {isExtensionMode && (
        <>
          <VoucherExtensionPanel
            isOpen={dashboard.voucherPanelState.isOpen}
            voucherUrl={dashboard.voucherPanelState.voucherUrl}
            depositData={dashboard.voucherPanelState.depositData}
            onClose={dashboard.handleCloseVoucherPanel}
            forceLight={isExtensionMode}
          />

          <FloatingDepositMetaOverlay
            isOpen={dashboard.voucherPanelState.isOpen}
            depositData={dashboard.voucherPanelState.depositData}
            onClose={dashboard.handleCloseVoucherPanel}
          />
        </>
      )}
    </div>
  );
}

export default AppShell;
