import fs from "fs";

// 1. Añadir a useDepositForm.js
let formPath = "src/features/deposit-detail/hooks/useDepositForm.js";
let formCode = fs.readFileSync(formPath, "utf8");
const formInject = `
  const handleFileSelectFromPicker = (url) => {
    setEditableData((prev) => ({ ...prev, imagen_voucher: url }));
  };
`;
if (!formCode.includes("handleFileSelectFromPicker")) {
  formCode = formCode.replace(
    "  const handleChange = (field, value) => {",
    formInject + "\n  const handleChange = (field, value) => {"
  );
  formCode = formCode.replace("handleChange,", "handleChange,\n    handleFileSelectFromPicker,");
  fs.writeFileSync(formPath, formCode, "utf8");
}

// 2. Añadir a useDepositActions.js
let actPath = "src/features/deposit-detail/hooks/useDepositActions.js";
let actCode = fs.readFileSync(actPath, "utf8");
const actInject = `
  const handleToggleEsAntiguo = async () => {
    if (isProcessing) return; 

    setIsProcessing(true);
    const trace = \`deposit.revision:\${deposit.id}\`;
    console.time(trace);
    
    const newValue = !deposit.es_antiguo;

    // ACTUALIZACIÓN OPTIMISTA INMEDIATA
    const updatedDeposit = {
      ...deposit,
      es_antiguo: newValue,
    };

    onUpdateDeposit(updatedDeposit);

    try {
      const response = await apiPut(\`/depositos/\${deposit.id}\`, {
        es_antiguo: newValue,
      });

      if (response.error) {
        onUpdateDeposit(deposit); 
        alert(\`Error al actualizar: \${response.error}\`);
        return;
      }

      if (newValue && yCloudConfigId) {
        const mensajeAntiguo = \`⚠️ *Voucher en Revisión*

El depósito es de día(s) anterior(es), se está realizando los cruces de información, apenas se termine se atenderá.

*No volver a enviar el voucher.*

Gracias por su comprensión.\`;

        try {
          const telefonoContacto =
            deposit.trabajador?.telefono_origen || deposit.sucursal?.telefono;

          if (telefonoContacto) {
            const telefonoFormateado = formatPhoneForYCloud(telefonoContacto);
            const replyMessageId = getReplyMessageIdFromDeposit(deposit);
            
            const result = await yCloudService.sendTextMessage(
              buildYCloudMessagePayload({
                configId: yCloudConfigId,
                to: telefonoFormateado,
                text: mensajeAntiguo,
                replyMessageId,
                forceReply: true,
              }),
            );

            if (result.success) {
              alert(\`✅ Mensaje enviado:\\n\\n\${mensajeAntiguo}\`);
            } else {
              alert(\`⚠️ No se pudo enviar el mensaje:\\n\${result.message}\`);
            }
          }
        } catch (error) {
          alert(\`❌ Error al enviar mensaje:\\n\${error.message}\`);
        }
      }
    } catch (error) {
      onUpdateDeposit(deposit);
      alert(\`Error inesperado: \${error.message}\`);
    } finally {
      setIsProcessing(false);
    }
  };
`;
if (!actCode.includes("handleToggleEsAntiguo")) {
  actCode = actCode.replace(
    "  const handleCheckDuplicates = async () => {",
    actInject + "\n  const handleCheckDuplicates = async () => {"
  );
  actCode = actCode.replace("handleCheckDuplicates,", "handleCheckDuplicates,\n    handleToggleEsAntiguo,");
  fs.writeFileSync(actPath, actCode, "utf8");
}

// 3. Importarlos en DepositDetailModal.jsx
let modPath = "src/features/deposit-detail/ui/DepositDetailModal.jsx";
let modCode = fs.readFileSync(modPath, "utf8");
if (!modCode.includes("handleFileSelectFromPicker")) {
  modCode = modCode.replace(
    "handleChange,",
    "handleChange,\n    handleFileSelectFromPicker,"
  );
}
if (!modCode.includes("handleToggleEsAntiguo")) {
  modCode = modCode.replace(
    "handleCheckDuplicates,",
    "handleCheckDuplicates,\n    handleToggleEsAntiguo,"
  );
}
fs.writeFileSync(modPath, modCode, "utf8");
