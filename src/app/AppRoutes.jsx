import { Navigate, Route, Routes } from "react-router-dom";
import BancosView from "../components/BancosView";
import CambiarContrasena from "../components/CambiarContrasena";
import ConfirmadosPorHoraView from "../components/ConfirmadosPorHoraView";
import DocumentosView from "../components/DocumentosView";
import ExportarVouchersView from "../components/ExportarVouchersView";
import GestionBancosView from "../components/GestionBancosView";
import GestionEmpresasView from "../components/GestionEmpresasView";
import KanbanView from "../pages/deposits-kanban/ui/KanbanPage.jsx";
import RegularizarDepositos from "../components/RegularizarDepositos";
import ReportesView from "../components/ReportesView";
import SucursalesView from "../components/SucursalesView";
import TableView from "../pages/deposits-table/ui/TablePage.jsx";
import UsuariosView from "../components/UsuariosView";
import AuthPage from "../features/auth/pages/AuthPage.jsx";
import PendingApproval from "../features/auth/pages/PendingApproval.jsx";

export function AppRoutes({
  currentUser,
  dashboard,
  detailPresentationMode,
  isExtensionMode,
}) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/kanban" replace />} />
      <Route
        path="/kanban"
        element={
          <KanbanView
            deposits={dashboard.depositsWithFullData}
            onUpdateDeposit={dashboard.handleUpdateDeposit}
            onTakeDeposit={dashboard.handleTakeDepositForValidation}
            onFetchDepositsByDate={dashboard.fetchDepositsByDate}
            onFetchAllDeposits={dashboard.fetchAllDeposits}
            onSelectedDateChange={dashboard.handleSelectedDateChange}
            onSelectDate={dashboard.handleSelectDate}
            empresas={dashboard.empresas}
            bancos={dashboard.bancos}
            cuentas={dashboard.cuentas}
            onOpenVoucherWindow={dashboard.handleOpenVoucherWindow}
            connectionStatus={{
              supabaseConnected: dashboard.isSupabaseConnected,
              realtimeStatus: dashboard.realtimeStatus,
              realtimeErrors: dashboard.realtimeErrors,
            }}
            showConnectionStatus={!isExtensionMode}
            realtimeActivity={dashboard.realtimeActivity}
            workloadAlarmActive={dashboard.workloadAlarmActive}
            pendingWorkloadCount={dashboard.pendingWorkloadCount}
            workloadThreshold={dashboard.workloadThreshold}
            onRequestReplacementHelp={dashboard.requestReplacementHelp}
            replacementRequestState={dashboard.replacementRequestState}
            detailPresentationMode={detailPresentationMode}
          />
        }
      />
      <Route
        path="/table"
        element={
          <TableView
            deposits={dashboard.depositsWithFullData}
            onUpdateDeposit={dashboard.handleUpdateDeposit}
            onFetchDepositsByDate={dashboard.fetchDepositsByDate}
            onFetchDepositsByPeriod={dashboard.fetchDepositsByPeriod}
            onSelectedDateChange={dashboard.handleSelectedDateChange}
            onSelectDate={dashboard.handleSelectDate}
            empresas={dashboard.empresas}
            bancos={dashboard.bancos}
            cuentas={dashboard.cuentas}
            onOpenVoucherWindow={dashboard.handleOpenVoucherWindow}
            detailPresentationMode={detailPresentationMode}
          />
        }
      />
      <Route
        path="/sucursales"
        element={
          <SucursalesView
            sucursales={dashboard.sucursales}
            deposits={dashboard.depositsWithFullData}
            onAddSucursal={dashboard.handleAddSucursal}
            onUpdateSucursal={dashboard.handleUpdateSucursal}
            onDeleteSucursal={(id) => dashboard.handleUpdateSucursal(id, { estado: "inactiva" })}
            onAddPersonal={dashboard.handleAddPersonalToSucursal}
            onRemovePersonal={dashboard.handleRemovePersonalFromSucursal}
            onUpdatePersonal={dashboard.handleUpdatePersonal}
          />
        }
      />
      <Route
        path="/bancos"
        element={
          <BancosView
            bancos={dashboard.bancos}
            empresas={dashboard.empresas}
            onAddEmpresa={dashboard.handleAddEmpresa}
            cuentas={dashboard.cuentas}
            onAddCuenta={dashboard.handleAddCuenta}
            onUpdateCuenta={dashboard.handleUpdateCuenta}
            onDeleteCuenta={dashboard.handleDeleteCuenta}
            onBatchAddCuentas={dashboard.handleBatchAddCuentas}
          />
        }
      />
      <Route
        path="/gestion-bancos"
        element={
          <GestionBancosView
            bancos={dashboard.bancos}
            onAdd={dashboard.handleAddBanco}
            onUpdate={dashboard.handleUpdateBanco}
            onDelete={dashboard.handleDeleteBanco}
          />
        }
      />
      <Route
        path="/gestion-empresas"
        element={
          <GestionEmpresasView
            empresas={dashboard.empresas}
            onAdd={dashboard.handleAddEmpresa}
            onUpdate={dashboard.handleUpdateEmpresa}
          />
        }
      />
      <Route
        path="/usuarios"
        element={currentUser?.user_rol === "admin" ? <UsuariosView /> : <Navigate to="/kanban" replace />}
      />
      <Route path="/reportes" element={<ReportesView />} />
      <Route path="/confirmados" element={<ConfirmadosPorHoraView />} />
      <Route path="/apoyo" element={<Navigate to="/confirmados" replace />} />
      <Route path="/documentos" element={<DocumentosView />} />
      <Route path="/exportar-vouchers" element={<ExportarVouchersView />} />
      <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
      <Route
        path="/regularizar-depositos"
        element={
          <RegularizarDepositos
            onDepositUpdated={() =>
              dashboard.currentSelectedDate ? dashboard.refreshDeposits() : dashboard.fetchAllDeposits()
            }
          />
        }
      />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/pending-approval" element={<PendingApproval />} />
    </Routes>
  );
}

export default AppRoutes;
