import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

// Remove the filteredAnexos.length === 0 condition from the first Anexo select
code = code.replace(
  /disabled=\{isFieldsOnlyEdit \? false : filteredAnexos\.length === 0 \|\| isFullEditDisabled\}/g,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

// Remove the filteredAnexos.length === 0 condition from the second Anexo select (responsive)
code = code.replace(
  /disabled=\{\s*isFieldsOnlyEdit\s*\?\s*false\s*:\s*filteredAnexos\.length === 0\s*\|\|\s*isFullEditDisabled\s*\}/g,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Removed restriction for Anexo select.");
