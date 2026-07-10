import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

// 1. Add fetchCuentas import
if (!code.includes("fetchCuentas")) {
  code = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";\n` + code;
}

// 2. Add useRef to React import if missing
if (!code.includes("useRef,")) {
  code = code.replace(/import React, \{([\s\S]*?)\} from "react";/, function(match, p1) {
    if (!p1.includes("useRef")) {
      return `import React, {${p1}  useRef,\n} from "react";`;
    }
    return match;
  });
}

// 3. Replace the loadAnexos useEffect
const regexUseEffect = /useEffect\(\(\) => \{\s*if \(editableData\.empresa_id && editableData\.banco_id\) \{\s*const relevantCuentas[\s\S]*?setFilteredAnexos\(\[\]\);\s*\}\s*\}, \[editableData\.empresa_id, editableData\.banco_id, cuentas\]\);/g;

const newUseEffect = `    useEffect(() => {
      let isMounted = true;
      async function loadAnexos() {
        if (editableData.empresa_id && editableData.banco_id) {
          try {
            const fetchedCuentas = await fetchCuentas(editableData.empresa_id, editableData.banco_id);
            if (!isMounted) return;
            const anexos = [...new Set(fetchedCuentas.map((c) => c.anexo || c.Anexo))].filter(Boolean);
            setFilteredAnexos(anexos);

            if (editableData.anexo && !anexos.includes(editableData.anexo)) {
              setEditableData((prev) => ({ ...prev, anexo: "" }));
            }
          } catch (error) {
            console.error("Error fetching anexos:", error);
            if (isMounted) setFilteredAnexos([]);
          }
        } else {
          if (isMounted) setFilteredAnexos([]);
        }
      }
      loadAnexos();
      return () => { isMounted = false; };
    }, [editableData.empresa_id, editableData.banco_id]);`;

code = code.replace(regexUseEffect, newUseEffect);

// 4. Remove filteredAnexos.length === 0 from disabled logic
code = code.replace(
  /disabled=\{isFieldsOnlyEdit \? false : filteredAnexos\.length === 0 \|\| isFullEditDisabled\}/g,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

code = code.replace(
  /disabled=\{\s*isFieldsOnlyEdit\s*\?\s*false\s*:\s*filteredAnexos\.length === 0\s*\|\|\s*isFullEditDisabled\s*\}/g,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

// 5. Inject lastInitializedDepositId useRef and wrap setEditableData
// Inject useRef before useEffect
if (!code.includes("lastInitializedDepositId")) {
  code = code.replace(/  useEffect\(\(\) => \{\s*if \(deposit\) \{/g, `  const lastInitializedDepositId = useRef(null);\n  useEffect(() => {\n    if (deposit) {`);
}

// Wrap setEditableData
const regexSetEditableData = /setEditableData\(\{\s*empresa_id: deposit\.empresa\?\.id \|\| "",\s*banco_id: deposit\.banco\?\.id \|\| "",\s*anexo: deposit\.anexo \|\| "",[\s\S]*?referencia_cliente: deposit\.referencia_cliente \|\| "",\s*\}\);/g;

const newSetEditableData = `      if (lastInitializedDepositId.current !== deposit.id) {
        setEditableData({
          empresa_id: deposit.empresa?.id || "",
          banco_id: deposit.banco?.id || "",
          anexo: deposit.anexo || "",
          monto: deposit.monto || 0,
          moneda: normalizeDepositCurrency(deposit.moneda),
          numero_operacion_banco:
            deposit.numero_operacion_banco || deposit.numero_operacion || "",
          fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),
          imagen_voucher: deposit.imagen_voucher || "",
          cliente: deposit.cliente || "",
          ruc_cliente: deposit.ruc_cliente || "",
          observaciones: deposit.observaciones || "",
          referencia_cliente: deposit.referencia_cliente || "",
        });
        lastInitializedDepositId.current = deposit.id;
      }`;

code = code.replace(regexSetEditableData, newSetEditableData);

fs.writeFileSync(filePath, code);
console.log("Ultimate patch applied.");
