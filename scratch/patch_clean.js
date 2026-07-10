import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");
let code = fs.readFileSync(filePath, "utf-8");

let changed = 0;

// Change 1: Add useRef to the React import
const oldReactImport = `import React, {\r\n  useState,\r\n  useEffect,\r\n  useContext,\r\n  useMemo,\r\n  useCallback,\r\n} from "react";`;
const newReactImport = `import React, {\r\n  useState,\r\n  useEffect,\r\n  useContext,\r\n  useMemo,\r\n  useCallback,\r\n  useRef,\r\n} from "react";`;
if (code.includes(oldReactImport)) {
  code = code.replace(oldReactImport, newReactImport);
  changed++;
  console.log("✓ Change 1: useRef added to React import");
} else {
  console.log("✗ Change 1 FAILED: React import not found");
}

// Change 2: Add fetchCuentas import at the top
if (!code.includes("fetchCuentas")) {
  code = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";\n` + code;
  changed++;
  console.log("✓ Change 2: fetchCuentas import added");
} else {
  console.log("  Change 2: fetchCuentas already imported");
}

// Change 3: Wrap setEditableData with lastInitializedDepositId guard and add fallbacks for empresa_id/banco_id
// The original block to replace:
const oldInit = `  useEffect(() => {\r\n    if (deposit) {\r\n      setEditableData({\r\n        empresa_id: deposit.empresa?.id || "",\r\n        banco_id: deposit.banco?.id || "",\r\n        anexo: deposit.anexo || "",\r\n        monto: deposit.monto || 0,\r\n        moneda: normalizeDepositCurrency(deposit.moneda),\r\n        numero_operacion_banco:\r\n          deposit.numero_operacion_banco || deposit.numero_operacion || "",\r\n        fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),\r\n        imagen_voucher: deposit.imagen_voucher || "",\r\n        cliente: deposit.cliente || "",\r\n        ruc_cliente: deposit.ruc_cliente || "",\r\n        observaciones: deposit.observaciones || "",\r\n        referencia_cliente: deposit.referencia_cliente || "",\r\n      });\r\n\r\n      // Inicializar datos del solicitante`;

const newInit = `  const lastInitializedDepositId = useRef(null);\r\n\r\n  useEffect(() => {\r\n    if (deposit) {\r\n      if (lastInitializedDepositId.current !== deposit.id) {\r\n        setEditableData({\r\n          empresa_id: deposit.empresa?.id || deposit.empresa_id || "",\r\n          banco_id: deposit.banco?.id || deposit.banco_id || "",\r\n          anexo: deposit.anexo || "",\r\n          monto: deposit.monto || 0,\r\n          moneda: normalizeDepositCurrency(deposit.moneda),\r\n          numero_operacion_banco:\r\n            deposit.numero_operacion_banco || deposit.numero_operacion || "",\r\n          fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),\r\n          imagen_voucher: deposit.imagen_voucher || deposit.imagenUrl || deposit.imagenVoucher || "",\r\n          cliente: deposit.cliente || "",\r\n          ruc_cliente: deposit.ruc_cliente || "",\r\n          observaciones: deposit.observaciones || "",\r\n          referencia_cliente: deposit.referencia_cliente || "",\r\n        });\r\n        lastInitializedDepositId.current = deposit.id;\r\n      }\r\n\r\n      // Inicializar datos del solicitante`;

if (code.includes(oldInit)) {
  code = code.replace(oldInit, newInit);
  changed++;
  console.log("✓ Change 3: setEditableData wrapped with lastInitializedDepositId guard");
} else {
  console.log("✗ Change 3 FAILED: useEffect init block not found exactly");
  // Debug: print the actual text around the area
  const idx = code.indexOf("setEditableData({\r\n        empresa_id:");
  if (idx !== -1) {
    console.log("Found at index:", idx);
    console.log("Context around it:", JSON.stringify(code.substring(idx - 100, idx + 200)));
  }
}

// Change 4: Replace the filteredAnexos useEffect to use the backend API
const oldAnexosEffect = `  useEffect(() => {\r\n    if (editableData.empresa_id && editableData.banco_id) {\r\n      const relevantCuentas = cuentas.filter(\r\n        (c) =>\r\n          c.empresa_id === editableData.empresa_id &&\r\n          c.banco_id === editableData.banco_id,\r\n      );\r\n      const anexos = [...new Set(relevantCuentas.map((c) => c.anexo))].filter(\r\n        Boolean,\r\n      );\r\n      setFilteredAnexos(anexos);\r\n\r\n      // Solo limpiar el anexo si no está en la lista, pero no asignar automáticamente el primero\r\n      if (editableData.anexo && !anexos.includes(editableData.anexo)) {\r\n        setEditableData((prev) => ({ ...prev, anexo: "" }));\r\n      }\r\n    } else {\r\n      setFilteredAnexos([]);\r\n    }\r\n  }, [editableData.empresa_id, editableData.banco_id, cuentas]);`;

const newAnexosEffect = `  useEffect(() => {\r\n    let isMounted = true;\r\n    async function loadAnexos() {\r\n      if (editableData.empresa_id && editableData.banco_id) {\r\n        try {\r\n          const fetchedCuentas = await fetchCuentas(editableData.empresa_id, editableData.banco_id);\r\n          if (!isMounted) return;\r\n          const anexos = [...new Set(fetchedCuentas.map((c) => c.anexo || c.Anexo))].filter(Boolean);\r\n          setFilteredAnexos(anexos);\r\n        } catch (error) {\r\n          console.error("Error fetching anexos:", error);\r\n          if (isMounted) setFilteredAnexos([]);\r\n        }\r\n      } else {\r\n        if (isMounted) setFilteredAnexos([]);\r\n      }\r\n    }\r\n    loadAnexos();\r\n    return () => { isMounted = false; };\r\n  }, [editableData.empresa_id, editableData.banco_id]);`;

if (code.includes(oldAnexosEffect)) {
  code = code.replace(oldAnexosEffect, newAnexosEffect);
  changed++;
  console.log("✓ Change 4: filteredAnexos useEffect replaced to use backend API");
} else {
  console.log("✗ Change 4 FAILED: filteredAnexos useEffect not found exactly");
}

// Change 5: Remove filteredAnexos.length === 0 from disabled (both selects)
const oldDisabled1 = `disabled={isFieldsOnlyEdit ? false : filteredAnexos.length === 0 || isFullEditDisabled}`;
const newDisabled1 = `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`;
const count1 = (code.match(new RegExp(oldDisabled1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (count1 > 0) {
  code = code.split(oldDisabled1).join(newDisabled1);
  changed++;
  console.log(`✓ Change 5a: Replaced ${count1} instances of filteredAnexos.length === 0 check`);
} else {
  console.log("  Change 5a: No exact match for short disabled pattern");
}

const oldDisabled2 = `disabled={\r\n                            isFieldsOnlyEdit\r\n                              ? false\r\n                              : filteredAnexos.length === 0 ||\r\n                                isFullEditDisabled\r\n                          }`;
const newDisabled2 = `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`;
const count2 = (code.match(new RegExp(oldDisabled2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
if (count2 > 0) {
  code = code.split(oldDisabled2).join(newDisabled2);
  changed++;
  console.log(`✓ Change 5b: Replaced ${count2} instances of multiline filteredAnexos check`);
} else {
  console.log("  Change 5b: No exact match for multiline disabled pattern");
}

fs.writeFileSync(filePath, code);
console.log(`\nDone. Total changes applied: ${changed}`);
