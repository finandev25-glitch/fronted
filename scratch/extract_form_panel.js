/**
 * extract_form_panel_v2.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uiDir = path.join(__dirname, "../src/features/deposit-detail/ui");
const modalPath = path.join(uiDir, "DepositDetailModal.jsx");
const panelPath = path.join(uiDir, "DepositFormPanel.jsx");

const code = fs.readFileSync(modalPath, "utf-8");

// Identificar el inicio del form en la presentacion normal
const startMarker = `                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">\r\n                    Datos Editables del Depósito\r\n                  </h4>`;
const startIndex = code.indexOf(startMarker);

// Identificar el fin del form (antes de Verificación de Duplicados)
const endMarker = `                  {!isFieldsOnlyEdit && (\r\n                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">`;
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Marcadores no encontrados en modo normal.");
  process.exit(1);
}

// Extraer el JSX del form
const formJsx = code.substring(startIndex, endIndex);

// Escribir el nuevo componente
const formPanelContent = `import React from "react";
import { Building, CreditCard, Hash, Calendar, DollarSign, User, Fingerprint, Info, MessageSquare } from "lucide-react";
import { FormRow } from "../../deposits/components/depositDetailModalHelpers.jsx";

export const DepositFormPanel = ({
  editableData,
  handleChange,
  isFieldsOnlyEdit,
  isFullEditDisabled,
  activeEmpresas,
  activeBancos,
  filteredAnexos,
  selectedMoneda,
  nroOperacionClasses,
  deposit
}) => {
  return (
    <>
${formJsx}
    </>
  );
};
`;

fs.writeFileSync(panelPath, formPanelContent, "utf-8");

// Reemplazar en el modal
let newModalCode = code.substring(0, startIndex) +
  `                  <DepositFormPanel 
                    editableData={editableData}
                    handleChange={handleChange}
                    isFieldsOnlyEdit={isFieldsOnlyEdit}
                    isFullEditDisabled={isFullEditDisabled}
                    activeEmpresas={activeEmpresas}
                    activeBancos={activeBancos}
                    filteredAnexos={filteredAnexos}
                    selectedMoneda={selectedMoneda}
                    nroOperacionClasses={nroOperacionClasses}
                    deposit={deposit}
                  />\r\n` +
  code.substring(endIndex);

// Tenemos que hacer lo mismo para el modo compacto que está duplicado!
const compactStartMarker = `                    <div className="grid gap-4">\r\n                      <div className="space-y-1">`;
const compactStartIndex = newModalCode.indexOf(compactStartMarker);

// El fin en el modo compacto es antes de los botones de accion de check duplicates
const compactEndMarker = `                    <div className="grid grid-cols-3 gap-2">`;
const compactEndIndex = newModalCode.indexOf(compactEndMarker, compactStartIndex);

if (compactStartIndex !== -1 && compactEndIndex !== -1) {
  console.log("Extrayendo versión compacta...");
  const compactFormJsx = newModalCode.substring(compactStartIndex, compactEndIndex);
  
  const compactPanelPath = path.join(uiDir, "DepositCompactFormFields.jsx");
  const compactPanelContent = `import React from "react";

export const DepositCompactFormFields = ({
  editableData,
  handleChange,
  isFieldsOnlyEdit,
  isFullEditDisabled,
  activeEmpresas,
  activeBancos,
  filteredAnexos,
  selectedMoneda,
  deposit,
  runCompactSearch,
  compactVoucherUrl,
  isCompactSearching,
  nroOperacionClasses
}) => {
  return (
    <>
${compactFormJsx}
    </>
  );
};
`;
  fs.writeFileSync(compactPanelPath, compactPanelContent, "utf-8");
  
  newModalCode = newModalCode.substring(0, compactStartIndex) +
    `                      <DepositCompactFormFields 
                        editableData={editableData}
                        handleChange={handleChange}
                        isFieldsOnlyEdit={isFieldsOnlyEdit}
                        isFullEditDisabled={isFullEditDisabled}
                        activeEmpresas={activeEmpresas}
                        activeBancos={activeBancos}
                        filteredAnexos={filteredAnexos}
                        selectedMoneda={selectedMoneda}
                        deposit={deposit}
                        runCompactSearch={runCompactSearch}
                        compactVoucherUrl={compactVoucherUrl}
                        isCompactSearching={isCompactSearching}
                        nroOperacionClasses={nroOperacionClasses}
                      />\r\n` +
    newModalCode.substring(compactEndIndex);

  // Agregar import statements
  const importInjectPoint = newModalCode.indexOf(`import {`);
  const finalCode = newModalCode.substring(0, importInjectPoint) + 
    `import { DepositFormPanel } from "./DepositFormPanel.jsx";\r\nimport { DepositCompactFormFields } from "./DepositCompactFormFields.jsx";\r\n` + 
    newModalCode.substring(importInjectPoint);

  fs.writeFileSync(modalPath, finalCode, "utf-8");
  console.log("Componentes normal y compacto extraídos y modal actualizado.");
} else {
  // Agregar import statements solo para normal
  const importInjectPoint = newModalCode.indexOf(`import {`);
  const finalCode = newModalCode.substring(0, importInjectPoint) + 
    `import { DepositFormPanel } from "./DepositFormPanel.jsx";\r\n` + 
    newModalCode.substring(importInjectPoint);

  fs.writeFileSync(modalPath, finalCode, "utf-8");
  console.log("No se encontró la versión compacta. Modal actualizado solo con versión normal.");
}
