import React, { useContext, useState } from "react";
import { AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import DepositDetailModal from "../../../features/deposit-detail/ui/DepositDetailModal.jsx";
import DepositsTableToolbar from "../../../widgets/deposits-table-controls/ui/DepositsTableToolbar.jsx";
import DepositsTable from "../../../widgets/deposits-table-grid/ui/DepositsTable.jsx";
import RegularizeImageModal from "../../../features/deposits/components/RegularizeImageModal.jsx";
import VoucherExportModal from "../../../features/deposits/components/VoucherExportModal.jsx";
import { AuthContext } from "../../../features/auth/context/AuthContext.jsx";
import {
  markDepositForRegularize,
  unmarkDepositForRegularize,
  financeRegularizeImage,
  exportVouchersZip,
} from "../../../features/deposits/api/depositsApi.js";
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
  sucursales,
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
  const [regularizeUploadDeposit, setRegularizeUploadDeposit] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const userRol = currentUser?.user_rol || currentUser?.rol || "";
  const canRegularize = userRol === "finanzas" || userRol === "admin";

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

  // Respaldo masivo de vouchers en ZIP (GET /v1/deposits/export-vouchers-zip),
  // organizado por fecha de depósito y sucursal, solo depósitos validados,
  // solo finanzas/admin. Reemplaza un bloque anterior que apuntaba a
  // "/documents/vouchers/export-filtered", un endpoint que nunca existió en
  // el backend y que tampoco estaba conectado a ningún botón visible.
  const handleDownloadVouchersZip = async ({ sucursalId, fechaDesde, fechaHasta }) => {
    const zipBlob = await exportVouchersZip({ sucursalId, fechaDesde, fechaHasta });

    if (!zipBlob || zipBlob.size === 0) {
      throw new Error("El backend devolvió un archivo vacío.");
    }

    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(zipBlob);
    link.href = objectUrl;
    link.download = "vouchers_respaldo.zip";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  // Marcar/desmarcar un deposito para regularizar (solo finanzas/admin,
  // independiente de su Estado): el vendedor puede haber mandado una
  // imagen/pdf incompleta y hay que avisar que se le va a subir una nueva
  // mas tarde, sin tocar el Estado actual ni reprocesarlo con el worker. No
  // se pide/envia motivo desde el fronted.
  const handleMarkRegularize = async (deposit) => {
    if (!canRegularize) return;
    if (!window.confirm("¿Marcar este depósito para regularizar el voucher?")) return;

    try {
      await markDepositForRegularize(deposit.id);
      onUpdateDeposit({ ...deposit, pendiente_regularizar: true }, { skipPersist: true });
    } catch (error) {
      alert(`No se pudo marcar el depósito: ${error.message}`);
    }
  };

  const handleUnmarkRegularize = async (deposit) => {
    if (!canRegularize) return;
    if (!window.confirm("¿Quitar la marca de regularizar de este depósito?")) return;

    try {
      await unmarkDepositForRegularize(deposit.id);
      onUpdateDeposit({ ...deposit, pendiente_regularizar: false }, { skipPersist: true });
    } catch (error) {
      alert(`No se pudo desmarcar el depósito: ${error.message}`);
    }
  };

  const handleOpenRegularizeUpload = (deposit) => {
    if (!canRegularize) return;
    setRegularizeUploadDeposit(deposit);
  };

  // Sube el archivo nuevo via PUT /finance-regularize-image. A diferencia
  // del flujo de regularizacion del vendedor, esto NO cambia el Estado ni
  // encola nada al python-worker -- el backend solo reemplaza el archivo.
  // La URL del voucher en la tabla (imagen_voucher) ya apunta al endpoint
  // "redirect" estable (ver depositsApi.js/buildVoucherImageUrl), asi que no
  // hace falta actualizarla aca: al re-visitarla el backend firma de nuevo
  // contra el objeto GCS ya reemplazado.
  const handleSubmitRegularizeImage = async (imagenBase64) => {
    if (!regularizeUploadDeposit) return;
    await financeRegularizeImage(regularizeUploadDeposit.id, imagenBase64);
    onUpdateDeposit(
      { ...regularizeUploadDeposit, pendiente_regularizar: false },
      { skipPersist: true }
    );
    setRegularizeUploadDeposit(null);
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
          canExportVouchers={canRegularize}
          onOpenExportVouchers={() => setShowExportModal(true)}
        />

        <DepositsTable
          filteredDeposits={filteredDeposits}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          getStatusBadge={getStatusBadge}
          onEditDeposit={handleEditClick}
          onViewVoucher={handleViewVoucher}
          canRegularize={canRegularize}
          onMarkRegularize={handleMarkRegularize}
          onUnmarkRegularize={handleUnmarkRegularize}
          onOpenRegularizeUpload={handleOpenRegularizeUpload}
        />
      </div>
      {regularizeUploadDeposit && (
        <RegularizeImageModal
          deposit={regularizeUploadDeposit}
          onClose={() => setRegularizeUploadDeposit(null)}
          onSubmit={handleSubmitRegularizeImage}
        />
      )}

      {showExportModal && (
        <VoucherExportModal
          sucursales={sucursales}
          onClose={() => setShowExportModal(false)}
          onSubmit={handleDownloadVouchersZip}
        />
      )}

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
