import {
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";

export const FALLBACK_VOUCHER_PREVIEW =
  "https://placehold.co/600x400/e2e8f0/e2e8f0?text=Voucher";

export const getStatusInfo = (estado) => {
  switch (estado) {
    case "procesado":
      return {
        Icon: Clock,
        label: "Pendiente",
        color:
          "text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/50",
      };
    case "en_validacion":
      return {
        Icon: AlertCircle,
        label: "En Validación",
        color:
          "text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50",
      };
    case "confirmado":
      return {
        Icon: CheckCircle,
        label: "confirmado",
        color:
          "text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/50",
      };
    case "rechazado":
      return {
        Icon: XCircle,
        label: "Rechazado",
        color: "text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/50",
      };
    default:
      return {
        Icon: Clock,
        label: "Desconocido",
        color: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700",
      };
  }
};

export const FormRow = ({ icon: Icon, label, children }) => (
  <div>
    <label className="mb-0.5 flex items-center text-xs font-medium text-gray-700 dark:text-gray-300">
      <Icon className="mr-1.5 h-3 w-3 text-gray-500 dark:text-gray-400" />
      {label}
    </label>
    {children}
  </div>
);

export const CompactFieldCard = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/80">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
    <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{value || "-"}</div>
  </div>
);

export const normalizeDateForInput = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return "";

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split("/");
      return `${year}-${month}-${day}`;
    }
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatSqlMovementDate = (value) => {
  if (!value) return "-";
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return "-";

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [year, month, day] = raw.slice(0, 10).split("-");
      return `${day}/${month}/${year}`;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const hasSqlMovementAttentionData = (row) =>
  ["ValidadoPor", "OBSERVACION", "Observacion"].some((field) => {
    const value = row?.[field];
    const text = String(value ?? "").trim();
    return text.length > 0 && text !== "-";
  });

export const getReplyMessageIdFromDeposit = (deposit) => deposit?.chatwoot_message_id || null;

export const getSqlServerCompanyConfigFromEmpresaId = (empresaId, empresas = []) => {
  const companyId = String(empresaId ?? "").trim();
  const selectedEmpresa = empresas.find((empresa) => String(empresa?.id) === companyId) || null;
  const companyText = String(
    selectedEmpresa?.nombre || selectedEmpresa?.alias || "",
  ).toLowerCase();

  if (companyText.includes("jch")) {
    return { empresa: "1", empresaNombre: "JCH COMERCIAL SA" };
  }

  if (companyText.includes("evolution")) {
    return { empresa: "2", empresaNombre: "EVOLUTION CAR SERVICE EIRL" };
  }

  if (companyId === "1") {
    return { empresa: "1", empresaNombre: "JCH COMERCIAL SA" };
  }

  if (companyId === "2") {
    return { empresa: "2", empresaNombre: "EVOLUTION CAR SERVICE EIRL" };
  }

  return { empresa: "", empresaNombre: "" };
};

export const getSqlServerDefaultRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return {
    fechaInicio: `${year}-01-01`,
    fechaFin: `${year}-${month}-${day}`,
  };
};

export const getYYYYMMFromDate = (date, monthOffset = 0) => {
  const base = new Date(date);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
};

export const getSqlMovementSelectionLabel = (deposit) => {
  const personal = String(deposit?.trabajador?.nombre || deposit?.trabajador_nombre || "").trim();
  const sucursal = String(deposit?.sucursal?.nombre || deposit?.sucursal_nombre || "").trim();

  return [personal, sucursal].filter(Boolean).join(" - ");
};

export const getSqlPeriodRangeFromYYYYMM = (period) => {
  const normalized = String(period || "").trim();
  if (!/^\d{6}$/.test(normalized)) return null;

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  const end = new Date(year, month, 0);
  const fechaInicio = `${year}-${String(month).padStart(2, "0")}-01`;
  const fechaFin = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(
    end.getDate(),
  ).padStart(2, "0")}`;

  return { fechaInicio, fechaFin };
};

export const SQL_MOVEMENTS_COLUMNS = [
  { key: "FECHA", label: "Fecha", hidden: false },
  { key: "BANCO", label: "Banco", hidden: false },
  { key: "NRO_OPER", label: "Nro. op.", hidden: false },
  { key: "DESCRIPCION", label: "Descripcion", hidden: false },
  { key: "ABONO", label: "Abono", hidden: false },
  { key: "REG", label: "Reg", hidden: false },
  { key: "Sucursal", label: "Sucursal", hidden: false },
  { key: "Contacto", label: "Contacto", hidden: false },
  { key: "ValidadoPor", label: "Validado por", hidden: false },
  { key: "Observacion", label: "Observación", hidden: false },
];

export const SQL_CORTADO_COLUMNS = [
  { key: "FECHA", label: "Fecha", hidden: false },
  { key: "BANCO", label: "Banco", hidden: false },
  { key: "NRO_OPER", label: "Nro. operación", hidden: false },
  { key: "DESCRIPCION", label: "Descripcion", hidden: false },
  { key: "CARGO", label: "Cargo", hidden: false },
  { key: "ABONO", label: "Abono", hidden: false },
  { key: "REG", label: "Reg", hidden: false },
  { key: "DIF", label: "Dif", hidden: false },
  { key: "REGISTRO", label: "Registro", hidden: false },
  { key: "GLOSA", label: "GLOSA", hidden: false },
];

export const formatSqlDateDDMMYYYY = (value) => {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return raw;
};

const VALID_DEPOSIT_CURRENCIES = new Set(["PEN", "USD"]);

export const normalizeDepositCurrency = (value) => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";

  if (VALID_DEPOSIT_CURRENCIES.has(raw)) {
    return raw;
  }

  if (raw === "S/" || raw === "S" || raw.includes("SOL")) {
    return "PEN";
  }

  if (raw === "$" || raw.includes("USD") || raw.includes("DOLAR")) {
    return "USD";
  }

  return "";
};

export const renderSqlCell = (value, key) => {
  if (value == null || value === "") return "-";
  if (key === "FECHA") return formatSqlDateDDMMYYYY(value);
  if (["ABONO", "REG", "CARGO", "DIF"].includes(key)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }
  return String(value);
};

export const normalizeSqlServerRow = (row) => {
  if (!row || typeof row !== "object") return row;

  const normalized = { ...row };

  normalized.Observacion =
    row.Observacion ?? row.OBSERVACION ?? row.observacion ?? row.OBSERVACIONES ?? row.observaciones ?? "";

  normalized.ValidadoPor =
    row.ValidadoPor ?? row.VALIDADOPOR ?? row.validado_por ?? row.validadoPor ?? "";

  normalized.Sucursal = row.Sucursal ?? row.SUCURSAL ?? row.sucursal ?? row.sucursal_nombre ?? "";

  normalized.Contacto = row.Contacto ?? row.CONTACTO ?? row.contacto ?? row.trabajador_nombre ?? "";

  return normalized;
};



export const extractSqlSelectionValues = (row) => {
    const selectedRow = row || null;
    const selectedNroOperacion = String(
      row?.NRO_OPER ??
        row?.NRO_OPERACION ??
        row?.numero_operacion_banco ??
        row?.numero_operacion ??
        row?.CUO ??
        row?.CUOA ??
        "",
    )
      .trim()
      .toUpperCase();
    const selectedFecha =
      row?.FECHA_EMISION || row?.FECHA_DOC || row?.FECHA_DEPOSITO || "";
    let selectedMonto = 0;
    if (row && typeof row === "object") {
      const keys = Object.keys(row);
      const possibleAmountKeys = keys.filter((k) =>
        k.toUpperCase().includes("IMPORTE"),
      );
      if (possibleAmountKeys.length > 0) {
        selectedMonto = Number(row[possibleAmountKeys[0]]) || 0;
      } else if ("MONTO" in row) {
        selectedMonto = Number(row.MONTO) || 0;
      }
    }
    const selectedTipoMov = (
      row?.TIPO_MOVIMIENTO ||
      row?.TIPO ||
      ""
    ).toLowerCase();

    return {
      selectedRow,
      selectedNroOperacion,
      selectedFecha,
      selectedMonto,
      selectedTipoMov,
    };
};
