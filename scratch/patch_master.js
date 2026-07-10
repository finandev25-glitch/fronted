import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

// 1. Añadir el import si no existe
if (!code.includes("fetchCuentas")) {
  code = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";\n` + code;
}

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

if (regexUseEffect.test(code)) {
  code = code.replace(regexUseEffect, newUseEffect);
  console.log("useEffect reemplazado usando regex.");
} else {
  console.log("ATENCIÓN: No se encontró el useEffect original de anexos.");
}

// 3. Quitar el bloqueo disabled={... filteredAnexos.length === 0 ...}
code = code.replace(
  /disabled=\{isFieldsOnlyEdit \? false : filteredAnexos\.length === 0 \|\| isFullEditDisabled\}/g,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

code = code.replace(
  /disabled=\{\s*isFieldsOnlyEdit\s*\?\s*false\s*:\s*filteredAnexos\.length === 0\s*\|\|\s*isFullEditDisabled\s*\}/g,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

fs.writeFileSync(filePath, code);
console.log("DepositDetailModal.jsx parchado completamente.");
