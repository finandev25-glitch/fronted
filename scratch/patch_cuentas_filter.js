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


// Fix cuentas filtering logic
code = code.replace(
  /const relevantCuentas = cuentas\.filter\([\s\S]*?c\.banco_id === editableData\.banco_id,\s*\);/m,
  `const relevantCuentas = cuentas.filter(
          (c) =>
            String(c.empresaId || c.empresa_id || "").toLowerCase() === String(editableData.empresa_id || "").toLowerCase() &&
            String(c.bancoId || c.banco_id || "").toLowerCase() === String(editableData.banco_id || "").toLowerCase()
        );`
);

code = code.replace(
  /const anexos = \[\.\.\.new Set\(relevantCuentas\.map\(\(c\) => c\.anexo\)\)\]\.filter\(/m,
  `const anexos = [...new Set(relevantCuentas.map((c) => c.anexo || c.Anexo))].filter(`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Patched filter logic correctly.");
