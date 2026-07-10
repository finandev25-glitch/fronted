import fs from "fs";

const file = "src/features/deposit-detail/ui/DepositDetailModal.jsx";
let code = fs.readFileSync(file, "utf8");

const toInsert = `
  const compactModalBorderClass =
    deposit.estado === "rechazado"
      ? "border-red-500/70"
      : deposit.estado === "en_validacion"
        ? "border-blue-500/70"
        : deposit.estado === "validado"
          ? "border-emerald-500/70"
          : deposit.estado === "recibido"
            ? "border-orange-500/70"
            : "border-slate-200";

  const compactModalHeaderClass =
    deposit.estado === "rechazado"
      ? "border-red-200 bg-red-50/95 dark:border-red-900/40 dark:bg-red-950/35"
      : deposit.estado === "en_validacion"
        ? "border-blue-200 bg-blue-50/95 dark:border-blue-900/40 dark:bg-blue-950/35"
        : deposit.estado === "validado"
          ? "border-emerald-200 bg-emerald-50/95 dark:border-emerald-900/40 dark:bg-emerald-950/35"
          : deposit.estado === "recibido"
            ? "border-orange-200 bg-orange-50/95 dark:border-orange-900/40 dark:bg-orange-950/35"
            : "border-gray-200 bg-white/95 dark:border-gray-800 dark:bg-gray-900/95";

  const compactModalHeaderTitleClass =
    deposit.estado === "rechazado"
      ? "text-red-900 dark:text-red-100"
      : deposit.estado === "en_validacion"
        ? "text-blue-900 dark:text-blue-100"
        : deposit.estado === "validado"
          ? "text-emerald-900 dark:text-emerald-100"
          : deposit.estado === "recibido"
            ? "text-orange-900 dark:text-orange-100"
            : "text-slate-900 dark:text-slate-100";

  const compactStoreDataRows = useMemo(
    () => [
      { label: "Banco", value: selectedBanco?.abreviatura || selectedBanco?.nombre || "-" },
      { label: "Anexo", value: editableData.anexo || deposit?.anexo || "-" },
      { label: "Moneda", value: selectedMoneda || "-" },
      { label: "Nro. op. banco", value: editableData.numero_operacion_banco || deposit?.numero_operacion_banco || "-" },
      { label: "Importe", value: formatCompactMoney(editableData.monto || deposit?.monto, selectedMoneda || deposit?.moneda) },
      { label: "Fecha depósito", value: editableData.fecha_deposito || deposit?.fecha_deposito || "-" },
    ],
    [deposit, editableData, selectedBanco, selectedMoneda],
  );

  const compactStoreDataText = useMemo(
    () =>
      compactStoreDataRows.map((row) => \`\${row.label}: \${row.value}\`).join("\\n"),
    [compactStoreDataRows],
  );
  const compactStoreDataSnapshot = duplicateStoreDataSnapshot || compactStoreDataText;
`;

// Insertar antes de compactContactRows
const targetStr = `  const compactContactRows = useMemo(`;
if (code.includes(targetStr) && !code.includes("compactStoreDataSnapshot")) {
  code = code.replace(targetStr, toInsert + "\n" + targetStr);
  fs.writeFileSync(file, code, "utf8");
  console.log("Variables compactas insertadas correctamente.");
} else {
  console.log("No se pudo insertar o ya estaban.");
}
