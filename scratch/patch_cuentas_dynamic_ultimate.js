import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

// Fix disabled property for Empresa and Banco which were incorrectly matched by the previous patch_modal.js
code = code.replace(
  /value=\{editableData\.empresa_id\}[\s\S]*?disabled=\{isFieldsOnlyEdit \? false : isFullEditDisabled \|\| filteredAnexos\.length === 0\}/,
  `value={editableData.empresa_id}
                            onChange={handleChange}
                            disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

code = code.replace(
  /value=\{editableData\.banco_id\}[\s\S]*?disabled=\{isFieldsOnlyEdit \? false : isFullEditDisabled \|\| filteredAnexos\.length === 0\}/,
  `value={editableData.banco_id}
                            onChange={handleChange}
                            disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

if (!code.includes("fetchCuentas")) {
  code = code.replace(
    /import \{ updateDeposit(.*?)\} from "\.\.\/\.\.\/deposits\/api\/depositsApi\.js";/,
    `import { updateDeposit$1, fetchCuentas } from "../../deposits/api/depositsApi.js";`
  );
}

// Rewriting useEffect completely with regex to avoid multiline exact matching string problems
code = code.replace(
  /useEffect\(\(\) => \{\s*if \(editableData\.empresa_id && editableData\.banco_id\) \{\s*const relevantCuentas = cuentas\.filter\([\s\S]*?\}, \[editableData\.empresa_id, editableData\.banco_id, cuentas\]\);/m,
  `useEffect(() => {
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
          console.error("Error fetching cuentas:", error);
          if (isMounted) setFilteredAnexos([]);
        }
      } else {
        if (isMounted) setFilteredAnexos([]);
      }
    }
    loadAnexos();
    
    return () => { isMounted = false; };
  }, [editableData.empresa_id, editableData.banco_id]);`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Patched filter logic correctly with dynamic fetchCuentas.");
