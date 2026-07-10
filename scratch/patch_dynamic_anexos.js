import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

// 1. Add fetchCuentas import if missing
if (!code.includes("fetchCuentas")) {
  code = code.replace(
    /import \{ updateDeposit(.*?)\} from "\.\.\/\.\.\/deposits\/api\/depositsApi\.js";/,
    \`import { updateDeposit$1, fetchCuentas } from "../../deposits/api/depositsApi.js";\`
  );
}

// 2. Replace the static useEffect with the dynamic one
code = code.replace(
  /useEffect\(\(\) => \{\s*if \(editableData\.empresa_id && editableData\.banco_id\) \{\s*const relevantCuentas = cuentas\.filter\([\s\S]*?\}, \[editableData\.empresa_id, editableData\.banco_id, cuentas\]\);/m,
  \`useEffect(() => {
    let isMounted = true;
    async function loadAnexos() {
      if (editableData.empresa_id && editableData.banco_id) {
        try {
          // LLAMAR AL ENDPOINT DE CUENTAS BANCARIAS como indic el usuario
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
  }, [editableData.empresa_id, editableData.banco_id]);\`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Patched dynamic fetchCuentas in modal.");
