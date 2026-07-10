/**
 * patch_definitive.js
 * 
 * Aplica SOLO los cambios mínimos necesarios para corregir el bug de
 * Empresa/Banco/Imagen en DepositDetailModal.jsx:
 * 
 * 1. Agrega useRef al import de React
 * 2. Agrega import de fetchCuentas
 * 3. Agrega lastInitializedDepositId (useRef) para evitar re-init por WebSocket
 * 4. Agrega fallback deposit.empresa_id / deposit.banco_id  
 * 5. Agrega fallback imagenUrl/imagenVoucher para la imagen
 * 6. Reemplaza el useEffect de filteredAnexos para usar el backend
 * 7. Elimina el bloqueo filteredAnexos.length === 0 del disabled
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "../src/features/deposit-detail/ui/DepositDetailModal.jsx");

let code = fs.readFileSync(filePath, "utf-8");
let applied = 0;

function applyReplacement(label, oldStr, newStr) {
  if (!code.includes(oldStr)) {
    console.log(`✗ ${label}: no encontrado en el archivo.`);
    // Try to diagnose
    const snippet = oldStr.substring(0, 60).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    console.log(`  Búsqueda: "${snippet}..."`);
    return false;
  }
  const count = code.split(oldStr).length - 1;
  if (count > 1) {
    console.log(`✗ ${label}: encontrado ${count} veces, es ambiguo. No se aplica.`);
    return false;
  }
  code = code.replace(oldStr, newStr);
  applied++;
  console.log(`✓ ${label}`);
  return true;
}

// 1. useRef al import de React
applyReplacement(
  "1. useRef en import React",
  `import React, {\r\n  useState,\r\n  useEffect,\r\n  useContext,\r\n  useMemo,\r\n  useCallback,\r\n} from "react";`,
  `import React, {\r\n  useState,\r\n  useEffect,\r\n  useContext,\r\n  useMemo,\r\n  useCallback,\r\n  useRef,\r\n} from "react";`
);

// 2. fetchCuentas import
if (!code.includes("fetchCuentas")) {
  code = `import { fetchCuentas } from "../../deposits/api/depositsApi.js";\n` + code;
  applied++;
  console.log("✓ 2. fetchCuentas import");
} else {
  console.log("  2. fetchCuentas ya importado");
}

// 3+4+5. Inicialización del setEditableData con useRef guard y fallbacks
applyReplacement(
  "3+4+5. useRef guard + fallbacks empresa_id, banco_id, imagen",
  `  useEffect(() => {\r\n    if (deposit) {\r\n      setEditableData({\r\n        empresa_id: deposit.empresa?.id || "",\r\n        banco_id: deposit.banco?.id || "",\r\n        anexo: deposit.anexo || "",\r\n        monto: deposit.monto || 0,\r\n        moneda: normalizeDepositCurrency(deposit.moneda),\r\n        numero_operacion_banco:\r\n          deposit.numero_operacion_banco || deposit.numero_operacion || "",\r\n        fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),\r\n        imagen_voucher: deposit.imagen_voucher || "",\r\n        cliente: deposit.cliente || "",\r\n        ruc_cliente: deposit.ruc_cliente || "",\r\n        observaciones: deposit.observaciones || "",\r\n        referencia_cliente: deposit.referencia_cliente || "",\r\n      });\r\n\r\n      // Inicializar datos del solicitante`,
  `  const lastInitializedDepositId = useRef(null);\r\n\r\n  useEffect(() => {\r\n    if (deposit) {\r\n      if (lastInitializedDepositId.current !== deposit.id) {\r\n        setEditableData({\r\n          empresa_id: deposit.empresa?.id || deposit.empresa_id || "",\r\n          banco_id: deposit.banco?.id || deposit.banco_id || "",\r\n          anexo: deposit.anexo || "",\r\n          monto: deposit.monto || 0,\r\n          moneda: normalizeDepositCurrency(deposit.moneda),\r\n          numero_operacion_banco:\r\n            deposit.numero_operacion_banco || deposit.numero_operacion || "",\r\n          fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),\r\n          imagen_voucher: deposit.imagen_voucher || deposit.imagenUrl || deposit.imagenVoucher || "",\r\n          cliente: deposit.cliente || "",\r\n          ruc_cliente: deposit.ruc_cliente || "",\r\n          observaciones: deposit.observaciones || "",\r\n          referencia_cliente: deposit.referencia_cliente || "",\r\n        });\r\n        lastInitializedDepositId.current = deposit.id;\r\n      }\r\n\r\n      // Inicializar datos del solicitante`
);

// 6. Reemplazar filteredAnexos useEffect para usar backend
applyReplacement(
  "6. filteredAnexos useEffect → backend API",
  `  useEffect(() => {\r\n    if (editableData.empresa_id && editableData.banco_id) {\r\n      const relevantCuentas = cuentas.filter(\r\n        (c) =>\r\n          c.empresa_id === editableData.empresa_id &&\r\n          c.banco_id === editableData.banco_id,\r\n      );\r\n      const anexos = [...new Set(relevantCuentas.map((c) => c.anexo))].filter(\r\n        Boolean,\r\n      );\r\n      setFilteredAnexos(anexos);\r\n\r\n      // Solo limpiar el anexo si no está en la lista, pero no asignar automáticamente el primero\r\n      if (editableData.anexo && !anexos.includes(editableData.anexo)) {\r\n        setEditableData((prev) => ({ ...prev, anexo: "" }));\r\n      }\r\n    } else {\r\n      setFilteredAnexos([]);\r\n    }\r\n  }, [editableData.empresa_id, editableData.banco_id, cuentas]);`,
  `  useEffect(() => {\r\n    let isMounted = true;\r\n    async function loadAnexos() {\r\n      if (!editableData.empresa_id || !editableData.banco_id) {\r\n        if (isMounted) setFilteredAnexos([]);\r\n        return;\r\n      }\r\n      try {\r\n        const cuentasBancarias = await fetchCuentas(editableData.empresa_id, editableData.banco_id);\r\n        if (!isMounted) return;\r\n        const anexos = [...new Set(cuentasBancarias.map((c) => c.anexo || c.Anexo))].filter(Boolean);\r\n        setFilteredAnexos(anexos);\r\n      } catch (err) {\r\n        console.error("Error cargando anexos:", err);\r\n        if (isMounted) setFilteredAnexos([]);\r\n      }\r\n    }\r\n    loadAnexos();\r\n    return () => { isMounted = false; };\r\n  }, [editableData.empresa_id, editableData.banco_id]);`
);

// 7a. Remover filteredAnexos.length === 0 del disabled (versión corta)
const old7a = `disabled={isFieldsOnlyEdit ? false : filteredAnexos.length === 0 || isFullEditDisabled}`;
const new7a = `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`;
const count7a = (code.split(old7a)).length - 1;
if (count7a > 0) {
  code = code.split(old7a).join(new7a);
  applied++;
  console.log(`✓ 7a. disabled: filteredAnexos.length === 0 removido (${count7a} ocurrencias)`);
} else {
  console.log("  7a. No hay filteredAnexos.length === 0 en disabled (versión corta)");
}

// 7b. Remover filteredAnexos.length === 0 del disabled (versión multilinea)
applyReplacement(
  "7b. disabled multiline filteredAnexos",
  `disabled={\r\n                            isFieldsOnlyEdit\r\n                              ? false\r\n                              : filteredAnexos.length === 0 ||\r\n                                isFullEditDisabled\r\n                          }`,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`
);

fs.writeFileSync(filePath, code);
console.log(`\n✅ Patch aplicado. Total de cambios: ${applied}`);
