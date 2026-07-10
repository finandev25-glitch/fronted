import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uiDir = path.join(__dirname, "../src/features/deposit-detail/ui");
const modalPath = path.join(uiDir, "DepositDetailModal.jsx");
const voucherPanelPath = path.join(uiDir, "DepositVoucherPanel.jsx");

const code = fs.readFileSync(modalPath, "utf-8");

const startMarker = `<div className="lg:col-span-6 flex flex-col h-full space-y-4">`;
const startIndex = code.indexOf(startMarker);

// Final del div del voucher panel: es antes del <div flex-shrink-0 items-center justify-end>
const endMarker = `          <div\r\n            className={\`flex flex-shrink-0`;
let endIndex = code.indexOf(endMarker);
if (endIndex === -1) {
  endIndex = code.indexOf(`          <div\n            className={\`flex flex-shrink-0`);
}

if (startIndex !== -1 && endIndex !== -1) {
  // Ajustar el endIndex para no incluir el <div flex-shrink-0...
  // El endMarker puede ser un poco distinto por espacios. Vamos a buscar el cierre exacto del panel de voucher.
  // El panel de voucher está en <div className="lg:col-span-6 flex flex-col h-full space-y-4">...</div>
  
  // Vamos a extraerlo de forma más robusta:
  const sectionCode = code.substring(startIndex, endIndex);
  // Tenemos que cerrar el div que falta, pero sectionCode ya tiene todo hasta el final de ese bloque.
  // Solo removemos algunos divs de cierre si es necesario. En este caso el div de `lg:grid-cols-9` y el `flex-1 min-h-0` se cierran ahi también.
  
  // Busquemos el final exacto de `<div className="lg:col-span-6 ...">`
  let html = code.substring(startIndex);
  let divCount = 0;
  let cutIndex = -1;
  let i = 0;
  
  while(i < html.length) {
    if (html.substring(i, i+4) === '<div') {
      divCount++;
    } else if (html.substring(i, i+5) === '</div') {
      divCount--;
      if (divCount === 0) {
        cutIndex = i + 6; // Incluye el '>'
        break;
      }
    }
    i++;
  }
  
  if (cutIndex !== -1) {
    const voucherJsx = html.substring(0, cutIndex);
    
    const panelContent = `import React from "react";
import { FALLBACK_VOUCHER_PREVIEW } from "../../deposits/constants/index.js";

export const DepositVoucherPanel = ({
  displayVoucherUrl,
  deposit,
  setIsFloatingIframeOpen
}) => {
  return (
    ${voucherJsx}
  );
};
`;
    fs.writeFileSync(voucherPanelPath, panelContent, "utf-8");
    
    let newModalCode = code.substring(0, startIndex) +
      `<DepositVoucherPanel 
                  displayVoucherUrl={displayVoucherUrl}
                  deposit={deposit}
                  setIsFloatingIframeOpen={setIsFloatingIframeOpen}
                />` +
      html.substring(cutIndex);
      
    const importInjectPoint = newModalCode.indexOf(`import {`);
    newModalCode = newModalCode.substring(0, importInjectPoint) + 
      `import { DepositVoucherPanel } from "./DepositVoucherPanel.jsx";\r\n` + 
      newModalCode.substring(importInjectPoint);

    fs.writeFileSync(modalPath, newModalCode, "utf-8");
    console.log("DepositVoucherPanel extraído con éxito!");
  } else {
    console.log("No se pudo parsear el HTML div del voucher");
  }
} else {
  console.log("Marcadores no encontrados", startIndex, endIndex);
}
