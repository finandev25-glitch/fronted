import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

// Reemplazar TODOS los selects de anexo con una versión a prueba de balas
code = code.replace(
  /<select[\s\S]*?name="anexo"[\s\S]*?<\/select>/g,
  `<select
    name="anexo"
    value={editableData.anexo || ""}
    onChange={(e) => setEditableData((prev) => ({ ...prev, anexo: e.target.value }))}
    className="w-full border rounded px-3 py-2 bg-white text-black"
    style={{ pointerEvents: "auto", display: "block" }}
  >
    <option value="">{filteredAnexos.length === 0 ? "N/A" : "Seleccionar"}</option>
    {filteredAnexos.map((a) => (
      <option key={a} value={a}>{a}</option>
    ))}
  </select>`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Bulletproof select applied.");
