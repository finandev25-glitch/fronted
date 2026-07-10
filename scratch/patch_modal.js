import fs from "fs";

let code = fs.readFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", "utf-8");

// 1. Add imports
code = code.replace(
  `import { updateDeposit } from "../../deposits/api/depositsApi.js";`,
  `import { updateDeposit, checkDuplicate as apiCheckDuplicate, fetchCuentas, lockDeposit, unlockDeposit } from "../../deposits/api/depositsApi.js";`
);

// 2. Change filteredAnexos useMemo to useState + useEffect
const useMemoRegex = /const filteredAnexos = useMemo\(\(\) => \{\s*return cuentas\.filter\([\s\S]*?\);\s*\}, \[cuentas, editableData\.empresa_id, editableData\.banco_id\]\);/m;
code = code.replace(
  useMemoRegex,
  `const [filteredAnexos, setFilteredAnexos] = useState([]);

  useEffect(() => {
    async function loadAnexos() {
      if (editableData.empresa_id && editableData.banco_id) {
        try {
          const fetchedCuentas = await fetchCuentas(editableData.empresa_id, editableData.banco_id);
          const anexos = [...new Set(fetchedCuentas.map((c) => c.anexo || c.Anexo))].filter(Boolean);
          setFilteredAnexos(anexos);

          if (editableData.anexo && !anexos.includes(editableData.anexo)) {
            setEditableData((prev) => ({ ...prev, anexo: "" }));
          }
        } catch (error) {
          console.error("Error fetching cuentas:", error);
          setFilteredAnexos([]);
        }
      } else {
        setFilteredAnexos([]);
      }
    }
    loadAnexos();
  }, [editableData.empresa_id, editableData.banco_id]);`
);

// 3. Fix validation arrays to allow empty anexo if filteredAnexos is empty
code = code.replace(
  `!editableData.anexo && <li>• Anexo</li>`,
  `(!editableData.anexo && filteredAnexos.length > 0) && <li>• Anexo</li>`
);

code = code.replace(
  `editableData.anexo &&\n    selectedMoneda;`,
  `(editableData.anexo || filteredAnexos.length === 0) &&\n    selectedMoneda;`
);

code = code.replace(
  `editableData.anexo &&\n    selectedMoneda &&\n    editableData.monto &&`,
  `(editableData.anexo || filteredAnexos.length === 0) &&\n    selectedMoneda &&\n    editableData.monto &&`
);

// 4. Update the Anexo select to show N/A and disable if empty
code = code.replace(
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled}`,
  `disabled={isFieldsOnlyEdit ? false : isFullEditDisabled || filteredAnexos.length === 0}`
);

code = code.replace(
  `<option value="">Seleccionar</option>`,
  `<option value="">{filteredAnexos.length === 0 ? "N/A" : "Seleccionar"}</option>`
);

// 5. Replace handleConfirmDepositWithMessage with handleConfirmDeposit
const handleConfirmRegex = /const handleConfirmDepositWithMessage = async \(\) => \{[\s\S]*?onClose\(\);\n  \};/m;
code = code.replace(
  handleConfirmRegex,
  `const handleConfirmDeposit = async () => {
    if (!canConfirm || isSending || isProcessing) return;

    setIsSending(true);
    setIsProcessing(true);

    const payload = {
      empresa_id: editableData.empresa_id,
      banco_id: editableData.banco_id,
      numero_operacion_banco: editableData.numero_operacion_banco,
      fecha_deposito: editableData.fecha_deposito,
      anexo: editableData.anexo,
      moneda: selectedMoneda,
      monto: Number(editableData.monto),
      cliente: editableData.cliente,
      ruc_cliente: editableData.ruc_cliente,
      observaciones: editableData.observaciones,
      referencia_cliente: editableData.referencia_cliente,
      trabajador_id: solicitanteData.trabajador_id,
      sucursal_id: solicitanteData.sucursal_id,
      estado: "confirmado",
    };

    try {
      await onUpdateDeposit({
        ...deposit,
        ...payload,
      });
      alert("✅ Depósito confirmado exitosamente");
    } catch (error) {
      console.error("❌ Error enviando confirmación:", error);
      alert(\`❌ Error confirmando depósito: \${error.message}\`);
    } finally {
      setIsSending(false);
      setIsProcessing(false);
    }
    onClose();
  };`
);

// 6. Fix Button texts and onClick handlers
code = code.replaceAll(`onClick={handleConfirmDepositWithMessage}`, `onClick={handleConfirmDeposit}`);
code = code.replaceAll(`Confirmar con YCloud`, `Confirmar`);

// 7. Fix check duplicate button
code = code.replace(
  `const handleCheckDuplicates = async () => {`,
  `const handleCheckDuplicates = async () => {
    setIsChecking(true);
    try {
      const response = await apiCheckDuplicate({
        monto: editableData.monto,
        moneda: selectedMoneda,
        numero_operacion_banco: editableData.numero_operacion_banco,
        excludeId: deposit.id,
      });
      setCheckResult({
        checked: true,
        isDuplicate: response.duplicates?.length > 0,
        duplicates: response.duplicates || [],
      });
      if (response.duplicates?.length > 0) {
        setIsDuplicateModalOpen(true);
      } else {
        setIsNoDuplicateModalOpen(true);
      }
    } catch (error) {
      console.error("Error al comprobar duplicados:", error);
      alert("Ocurrió un error al verificar los duplicados.");
    } finally {
      setIsChecking(false);
    }
    return; // Skip old logic`
);

fs.writeFileSync("src/features/deposit-detail/ui/DepositDetailModal.jsx", code);
console.log("Updated DepositDetailModal.jsx");
