import { Navigate, Route, Routes } from "react-router-dom";
import BancosView from "../components/BancosView";
import CambiarContrasena from "../components/CambiarContrasena";
import ConfirmadosPorHoraView from "../components/ConfirmadosPorHoraView";
import ExportarVouchersView from "../components/ExportarVouchersView";
import GestionBancosView from "../components/GestionBancosView";
import GestionEmpresasView from "../components/GestionEmpresasView";
import KanbanView from "../pages/deposits-kanban/ui/KanbanPage.jsx";
import RegularizarDepositos from "../components/RegularizarDepositos";
import ReportesView from "../components/ReportesView";
import SucursalesView from "../components/SucursalesView";
import TableView from "../pages/deposits-table/ui/TablePage.jsx";
import TrabajadoresView from "../components/TrabajadoresView";
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
            onUnlockDeposit={dashboard.handleUnlockDeposit}
            onFetchDepositsByDate={dashboard.fetchDepositsByDate}
            onFetchAllDeposits={dashboard.fetchAllDeposits}
            onSelectedDateChange={dashboard.handleSelectedDateChange}
            onSelectDate={dashboard.handleSelectDate}
            empresas={dashboard.empresas}
            bancos={dashboard.bancos}
            cuentas={dashboard.cuentas}
            sucursales={dashboard.sucursales}
            personal={dashboard.personal}
            onOpenVoucherWindow={dashboard.handleOpenVoucherWindow}
            connectionStatus={{
              isAuthenticated: dashboard.isAuthenticated,
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
            sucursales={dashboard.sucursales}
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
            empresas={dashboard.empresas}
            deposits={dashboard.depositsWithFullData}
            onAddSucursal={dashboard.handleAddSucursal}
            onUpdateSucursal={dashboard.handleUpdateSucursal}
            onDeleteSucursal={(id) => dashboard.handleUpdateSucursal(id, { estado: "inactivo" })}
            onAddPersonal={dashboard.handleAddPersonalToSucursal}
            onRemovePersonal={dashboard.handleRemovePersonalFromSucursal}
            onUpdatePersonal={dashboard.handleUpdatePersonal}
          />
        }
      />
      <Route
        path="/bancos"
        element={
          currentUser?.user_rol === "admin" ? (
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
          ) : (
            <Navigate to="/kanban" replace />
          )
        }
      />
      <Route
        path="/gestion-bancos"
        element={
          currentUser?.user_rol === "admin" ? (
            <GestionBancosView
              bancos={dashboard.bancos}
              onAdd={dashboard.handleAddBanco}
              onUpdate={dashboard.handleUpdateBanco}
              onDelete={dashboard.handleDeleteBanco}
            />
          ) : (
            <Navigate to="/kanban" replace />
          )
        }
      />
      <Route
        path="/gestion-empresas"
        element={
          currentUser?.user_rol === "admin" ? (
            <GestionEmpresasView
              empresas={dashboard.empresas}
              onAdd={dashboard.handleAddEmpresa}
              onUpdate={dashboard.handleUpdateEmpresa}
            />
          ) : (
            <Navigate to="/kanban" replace />
          )
        }
      />
      <Route
        path="/usuarios"
        element={
          currentUser?.user_rol === "admin" ? (
            <UsuariosView empresas={dashboard.empresas} sucursales={dashboard.sucursales} />
          ) : (
            <Navigate to="/kanban" replace />
          )
        }
      />
      <Route
        path="/trabajadores"
        element={
          currentUser?.user_rol === "admin" ? (
            <TrabajadoresView empresas={dashboard.empresas} sucursales={dashboard.sucursales} />
          ) : (
            <Navigate to="/kanban" replace />
          )
        }
      />
      <Route path="/reportes" element={<ReportesView />} />
      <Route path="/confirmados" element={<ConfirmadosPorHoraView />} />
      <Route path="/apoyo" element={<Navigate to="/confirmados" replace />} />
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
