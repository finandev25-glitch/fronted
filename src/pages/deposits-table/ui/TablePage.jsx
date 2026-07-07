import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import DepositDetailModal from "../../../features/deposit-detail/ui/DepositDetailModal.jsx";
import { apiBlob } from "../../../services/backendApi";
import DepositsTableToolbar from "../../../widgets/deposits-table-controls/ui/DepositsTableToolbar.jsx";
import DepositsTable from "../../../widgets/deposits-table-grid/ui/DepositsTable.jsx";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

const TablePage = ({
  deposits,
  onUpdateDeposit,
  onFetchDepositsByDate,
  onFetchDepositsByPeriod,
  onSelectedDateChange,
  onSelectDate,
  empresas,
  bancos,
  cuentas,
  onOpenVoucherWindow,
  detailPresentationMode = "default",
}) => {
  const [filteredDeposits, setFilteredDeposits] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState(() => {
    // Restaurar filtro de período desde localStorage
    return localStorage.getItem("tableView_filterPeriod") || "all";
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Restaurar mes seleccionado desde localStorage o usar mes actual
    const saved = localStorage.getItem("tableView_selectedMonth");
    if (saved) return saved;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [specificDate, setSpecificDate] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [modalEditMode, setModalEditMode] = useState("full"); // 'full' or 'fields-only'
  const [isExporting, setIsExporting] = useState(false);
  const [exportJob, setExportJob] = useState(null);

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
      // Extraer partes de la fecha sin crear objeto Date que cause problemas de timezone
      const [year, month, day] = isoString.split("T")[0].split("-");
      return `${day}/${month}/${year}`;
    } catch {
      return "-";
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Guardar filtros en localStorage para persistencia
  React.useEffect(() => {
    localStorage.setItem("tableView_filterPeriod", filterPeriod);
  }, [filterPeriod]);

  React.useEffect(() => {
    localStorage.setItem("tableView_selectedMonth", selectedMonth);
  }, [selectedMonth]);

  // useEffect para cargar datos cuando cambia el período a "month"
  React.useEffect(() => {
    if (filterPeriod === "month" && selectedMonth && onFetchDepositsByPeriod) {
      console.log("📅 TableView: Auto-cargando depósitos del mes:", selectedMonth);
      onFetchDepositsByPeriod(`month:${selectedMonth}`);
    }
  }, [filterPeriod]); // Solo cuando cambia filterPeriod, no selectedMonth

  React.useEffect(() => {
    let filtered = deposits;

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (deposit) =>
          (deposit.empresa?.nombre &&
            deposit.empresa.nombre
              .toLowerCase()
              .includes(lowerCaseSearchTerm)) ||
          (deposit.sucursal?.nombre &&
            deposit.sucursal.nombre
              .toLowerCase()
              .includes(lowerCaseSearchTerm)) ||
          (deposit.trabajador?.nombre &&
            deposit.trabajador.nombre
              .toLowerCase()
              .includes(lowerCaseSearchTerm)) ||
          (deposit.anexo &&
            deposit.anexo.toLowerCase().includes(lowerCaseSearchTerm)) ||
          (deposit.monto &&
            deposit.monto.toString().includes(lowerCaseSearchTerm)) ||
          (deposit.numero_operacion &&
            deposit.numero_operacion
              .toLowerCase()
              .includes(lowerCaseSearchTerm)) ||
          (deposit.estado &&
            deposit.estado
              .replace("_", " ")
              .toLowerCase()
              .includes(lowerCaseSearchTerm)) ||
          (deposit.ruc_cliente &&
            deposit.ruc_cliente.toLowerCase().includes(lowerCaseSearchTerm)) ||
          formatDate(deposit.fecha_deposito).includes(lowerCaseSearchTerm) ||
          formatDateTime(deposit.fecha_registro).includes(lowerCaseSearchTerm)
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((deposit) => deposit.estado === filterStatus);
    }

    // Ya no filtramos localmente por período porque App.jsx nos envía los datos pre-filtrados
    // Solo mantenemos el filtro local para búsqueda, estado y fecha específica

    // Filtro por fecha específica (solo cuando se selecciona una fecha específica)
    if (specificDate) {
      console.log("📅 TABLE: Aplicando filtro por fecha:", specificDate);
      filtered = filtered.filter((deposit) => {
        if (!deposit.fecha_solo_date) return false;
        return deposit.fecha_solo_date === specificDate;
      });
      console.log(
        `✅ TABLE: ${filtered.length} de ${deposits.length} depósitos filtrados`
      );
    }

    setFilteredDeposits(filtered);
  }, [deposits, searchTerm, filterStatus, specificDate]); // Removimos filterPeriod ya que ahora se maneja en App.jsx

  const handleEditClick = (deposit) => {
    setModalEditMode("full");
    setSelectedDeposit(deposit);
  };

  const handleCloseModal = () => {
    // NO regresar a pendiente - el depósito se queda en su estado actual
    // Esto permite que los depósitos "en_validacion" permanezcan ahí aunque se cierre el modal

    setSelectedDeposit(null);
    setModalEditMode("full"); // Reset mode on close
  };

  const handleExportExcel = () => {
    const dataToExport = filteredDeposits.map((deposit) => {
      const estadoLabels = {
        pendiente: "Pendiente",
        en_validacion: "En Validación",
        validado: "Validado",
        rechazado: "Rechazado",
      };

      return {
        Empresa: deposit.empresa?.nombre || "",
        Sucursal: deposit.sucursal?.nombre || "",
        Contacto: deposit.trabajador?.nombre || "",
        "Teléfono Contacto": deposit.trabajador?.telefono_origen
          ? (deposit.trabajador.telefono_origen.startsWith('51')
              ? deposit.trabajador.telefono_origen.slice(2)
              : deposit.trabajador.telefono_origen)
          : "",
        "Anexo Banco": deposit.anexo || "",
        "Nro Operación Banco": deposit.numero_operacion_banco || "",
        "Fecha Depósito": formatDate(deposit.fecha_deposito),
        Importe: deposit.monto || 0,
        Moneda: deposit.moneda || "",
        Estado: estadoLabels[deposit.estado] || deposit.estado,
        "Motivo Rechazo": deposit.motivo_rechazo || "",
        "Validado Por": deposit.validado_por_usuario?.nombre || "",
        "Fecha Recibido": formatDateTime(deposit.fecha_registro),
        "Nombre Cliente": deposit.cliente || "",
        "RUC/DNI Cliente": deposit.ruc_cliente || "",
        "Ref. Cliente": deposit.referencia_cliente || "",
        "URL Voucher": deposit.imagen_voucher || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Depositos");
    XLSX.writeFile(workbook, "listado_depositos.xlsx");
  };

  const handleExportVouchers = async () => {
    if (isExporting || filteredDeposits.length === 0) {
      alert(
        isExporting
          ? "Ya hay una exportaci?n en curso."
          : "No hay dep?sitos para exportar."
      );
      return;
    }

    const voucherCount = filteredDeposits.filter((deposit) => deposit.imagen_voucher).length;

    if (voucherCount === 0) {
      alert("No hay vouchers v?lidos para exportar.");
      return;
    }

    setIsExporting(true);
    setExportJob({
      jobId: null,
      status: "processing",
      progress: 0,
      total: voucherCount,
      processed: 0,
      filesAdded: 0,
      failures: [],
      error: null,
      message: "Preparando exportaci?n...",
    });

    try {
      setExportJob((prev) => ({
        ...(prev || {}),
        progress: 15,
        message: "Solicitando exportaci?n al backend...",
      }));

      const zipBlob = await apiBlob("/documents/vouchers/export-filtered", {
        method: "POST",
        body: {
          filterPeriod,
          selectedMonth,
          specificDate,
          searchTerm,
          filterStatus,
        },
      });

      if (!zipBlob || zipBlob.size === 0) {
        throw new Error("El backend devolvi? un archivo vac?o.");
      }

      setExportJob((prev) => ({
        ...(prev || {}),
        progress: 90,
        message: "Descarga lista, iniciando archivo...",
      }));

      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(zipBlob);
      link.href = objectUrl;
      link.download = "vouchers_depositos.zip";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      setExportJob((prev) => ({
        ...(prev || {}),
        status: "completed",
        progress: 100,
        message: "Descarga completada",
      }));
    } catch (error) {
      console.error("Error al exportar vouchers desde backend:", error);
      setExportJob((prev) => ({
        ...(prev || {}),
        status: "error",
        error: error.message,
        message: error.message || "Ocurri? un error al exportar los vouchers.",
      }));
      alert(error.message || "Ocurri? un error al exportar los vouchers.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewVoucher = (url) => {
    if (!url) {
      alert("Este depósito no tiene un voucher adjunto.");
      return;
    }
    const width = 800;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const windowFeatures = `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`;
    window.open(url, "VoucherWindow", windowFeatures);
  };

  const getStatusBadge = (estado) => {
    const config = {
      pendiente: {
        label: "Pendiente",
        icon: Clock,
        color:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
      },
      en_validacion: {
        label: "En Validación",
        icon: AlertCircle,
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
      },
      validado: {
        label: "Validado",
        icon: CheckCircle,
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
      },
      rechazado: {
        label: "Rechazado",
        icon: XCircle,
        color: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
      },
    };
    const {
      label,
      icon: Icon,
      color,
    } = config[estado] || {
      label: estado,
      icon: Clock,
      color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    };
    return (
      <span
        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}
      >
        <Icon size={12} />
        <span>{label}</span>
      </span>
    );
  };


  return (
    <>
      <div className="flex h-full flex-col p-6">
        <DepositsTableToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterPeriod={filterPeriod}
          setFilterPeriod={setFilterPeriod}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          specificDate={specificDate}
          setSpecificDate={setSpecificDate}
          onFetchDepositsByDate={onFetchDepositsByDate}
          onFetchDepositsByPeriod={onFetchDepositsByPeriod}
          onSelectedDateChange={onSelectedDateChange}
          onSelectDate={onSelectDate}
          onExportExcel={handleExportExcel}
        />

        <DepositsTable
          filteredDeposits={filteredDeposits}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          getStatusBadge={getStatusBadge}
          onEditDeposit={handleEditClick}
          onViewVoucher={handleViewVoucher}
        />
      </div>
      <AnimatePresence>
        {exportJob && isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-800"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Exportando vouchers
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.min(100, Math.max(0, Math.round(exportJob.progress || 0)))}%
                </span>
              </div>

              <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, exportJob.progress || 0))}%` }}
                />
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p>{exportJob.message || "Preparando exportación..."}</p>
                <p>
                  Procesados: {exportJob.processed || 0} / {exportJob.total || 0}
                </p>
                <p>Archivos incluidos: {exportJob.filesAdded || 0}</p>
                {Array.isArray(exportJob.failures) && exportJob.failures.length > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    Fallas parciales: {exportJob.failures.length}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDeposit && (
          <DepositDetailModal
            deposit={selectedDeposit}
            onClose={handleCloseModal}
            onUpdateDeposit={onUpdateDeposit}
            empresas={empresas}
            bancos={bancos}
            cuentas={cuentas}
            onOpenVoucherWindow={onOpenVoucherWindow}
            editMode={modalEditMode}
            presentationMode={detailPresentationMode}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default TablePage;
