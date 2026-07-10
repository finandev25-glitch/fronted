import fs from "fs";

const file = 'src/features/deposits/components/depositDetailModalHelpers.jsx';
let helper = fs.readFileSync(file, 'utf8');

const append = `
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
`;

fs.writeFileSync(file, helper + append, 'utf8');
