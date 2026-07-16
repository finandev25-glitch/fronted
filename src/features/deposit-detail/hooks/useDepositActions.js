import { useState, useCallback } from "react";
import { apiPut } from "../../../services/backendApi.js";
import {
  checkDuplicate,
  confirmDeposit,
  rejectDeposit,
  markDepositRegularizePending,
  uploadRegularizeVoucher,
} from "../../deposits/api/depositsApi.js";

// Lee un File y devuelve su contenido en base64 (data URL completa).
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Hook que encapsula la lógica de confirmación, rechazo y acciones sobre el depósito.
 */
export function useDepositActions({
  deposit,
  editableData,
  selectedMoneda,
  currentUser,
  empresas,
  bancos,
  onUpdateDeposit,
  onClose,
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [checkResult, setCheckResult] = useState({ checked: false, isDuplicate: false, message: "" });
  const [duplicateDeposits, setDuplicateDeposits] = useState([]);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);

  // ─── Valores derivados ──────────────────────────────────────────────────────
  const canCheckDuplicates =
    editableData.empresa_id &&
    editableData.banco_id &&
    editableData.anexo &&
    selectedMoneda &&
    editableData.monto &&
    editableData.numero_operacion_banco &&
    editableData.fecha_deposito;

  const canConfirm =
    !isChecking &&
    checkResult.checked &&
    !checkResult.isDuplicate &&
    editableData.empresa_id &&
    editableData.banco_id &&
    editableData.anexo &&
    selectedMoneda;

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const buildUpdatePayload = useCallback(
    (extraData) => {
      let finalVoucherUrl = editableData.imagen_voucher || null;
      if (finalVoucherUrl && finalVoucherUrl.includes("drive.google.com/file/d/")) {
        const fileId = finalVoucherUrl.split("/d/")[1].split("/")[0];
        finalVoucherUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
      return {
        ...extraData,
        empresa_id: editableData.empresa_id || null,
        banco_id: editableData.banco_id || null,
        anexo: editableData.anexo || null,
        monto: parseFloat(editableData.monto) || 0,
        moneda: selectedMoneda || null,
        numero_operacion_banco: editableData.numero_operacion_banco || null,
        fecha_deposito: editableData.fecha_deposito || null,
        imagen_voucher: finalVoucherUrl,
        cliente: editableData.cliente || null,
        ruc_cliente: editableData.ruc_cliente || null,
        observaciones: editableData.observaciones || null,
        referencia_cliente: editableData.referencia_cliente || null,
      };
    },
    [editableData, selectedMoneda],
  );

  // ─── Comprobar duplicados ────────────────────────────────────────────────────

  const handleToggleEsAntiguo = async () => {
    if (isProcessing) return; 

    setIsProcessing(true);
    const trace = `deposit.revision:${deposit.id}`;
    console.time(trace);
    
    const newValue = !deposit.es_antiguo;

    // ACTUALIZACIÓN OPTIMISTA INMEDIATA
    const updatedDeposit = {
      ...deposit,
      es_antiguo: newValue,
    };

    onUpdateDeposit(updatedDeposit);

    try {
      const response = await apiPut(`/depositos/${deposit.id}`, {
        es_antiguo: newValue,
      });

      if (response.error) {
        onUpdateDeposit(deposit);
        alert(`Error al actualizar: ${response.error}`);
        return;
      }
    } catch (error) {
      onUpdateDeposit(deposit);
      alert(`Error inesperado: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckDuplicates = useCallback(async () => {
    if (!canCheckDuplicates) {
      setCheckResult({
        checked: true,
        isDuplicate: true,
        message: "Completa empresa, banco, anexo, moneda, importe, nro. de operación y fecha de depósito antes de comprobar duplicados.",
      });
      return;
    }

    setIsChecking(true);
    setCheckResult({ checked: false, isDuplicate: false, message: "" });

    try {
      // FIX: antes llamaba a "/depositos/check-duplicate" (ruta inexistente,
      // en espanol) con "numero_operacion_banco" (campo que el backend no
      // reconoce). La ruta real es /v1/deposits/check-duplicate y el campo
      // que compara es "numeroOperacion" — ver DepositEndpoints.cs.
      const response = await checkDuplicate({
        monto: editableData.monto,
        moneda: selectedMoneda,
        numeroOperacion: editableData.numero_operacion_banco,
        excludeId: deposit.id,
      });

      const duplicates = response.duplicates || [];
      if (response.error) {
        setCheckResult({ checked: true, isDuplicate: true, message: "Error al comprobar: " + response.error });
        return;
      }

      if (duplicates.length > 0) {
        setDuplicateDeposits(duplicates);
        setCheckResult({
          checked: true,
          isDuplicate: true,
          message: response.message || `¡Alerta! Se encontraron ${duplicates.length} depósito(s) duplicado(s).`,
        });
      } else {
        setDuplicateDeposits([]);
        setCheckResult({
          checked: true,
          isDuplicate: false,
          message: response.message || "No se encontraron duplicados. Puede confirmar el depósito.",
        });
      }
    } catch (err) {
      setCheckResult({ checked: true, isDuplicate: true, message: "Error crítico: " + err.message });
    } finally {
      setIsChecking(false);
    }
  }, [canCheckDuplicates, deposit?.id, editableData, selectedMoneda]);

  // ─── Confirmar depósito ───────────────────────────────────────────────────────
  const handleConfirmDeposit = useCallback(async () => {
    if (!checkResult.checked) {
      alert("Primero debes comprobar duplicados.");
      return;
    }
    if (checkResult.isDuplicate) {
      alert("No puedes confirmar mientras el depósito esté marcado como duplicado.");
      return;
    }

    const missing = [];
    if (!editableData.empresa_id) missing.push("Empresa");
    if (!editableData.banco_id) missing.push("Banco");
    if (!editableData.anexo) missing.push("Anexo");
    if (!selectedMoneda) missing.push("Moneda");
    if (missing.length > 0) {
      alert(`Por favor, complete los campos requeridos: ${missing.join(", ")}`);
      return;
    }

    setIsSending(true);
    setIsProcessing(true);

    // FIX: antes esto era 100% local (onUpdateDeposit con estado="validado",
    // un valor que ni siquiera existe en el backend) y nunca llamaba al
    // endpoint real POST /v1/deposits/{id}/confirm. Ahora sí se llama, y se
    // manda "anexo" como el TEXTO seleccionado (editableData.anexo), no un id
    // — el backend guarda Anexo como texto libre (Deposito.Anexo: string?).
    try {
      await confirmDeposit(deposit.id, {
        observaciones: editableData.observaciones || undefined,
        anexo: editableData.anexo || undefined,
      });

      const payload = buildUpdatePayload({
        estado: "confirmado",
        motivo_rechazo: null,
        validado_por: currentUser.id,
        fecha_validacion: new Date().toISOString(),
      });

      onUpdateDeposit({ ...deposit, ...payload }, { skipPersist: true });
      alert("✅ Depósito confirmado exitosamente.");
      onClose();
    } catch (err) {
      alert(`❌ No se pudo confirmar el depósito: ${err.message}`);
    } finally {
      setIsSending(false);
      setIsProcessing(false);
    }
  }, [buildUpdatePayload, checkResult, currentUser, deposit, editableData, onClose, onUpdateDeposit, selectedMoneda]);

  // ─── Rechazar depósito ───────────────────────────────────────────────────────
  // FIX: ahora llama al endpoint real POST /v1/deposits/{id}/reject, que
  // exige "observaciones" en el body (antes esto tambien era 100% local).
  const handleConfirmRejection = useCallback(async (reason) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await rejectDeposit(deposit.id, {
        observaciones: reason,
        anexo: editableData.anexo || undefined,
      });

      const finalPayload = {
        estado: "rechazado",
        motivo_rechazo: reason,
        observaciones: reason,
        validado_por: currentUser.id,
        fecha_validacion: new Date().toISOString(),
      };

      onUpdateDeposit({ ...deposit, ...finalPayload }, { skipPersist: true });
      setIsRejectionModalOpen(false);
      onClose();
    } catch (err) {
      alert(`❌ No se pudo rechazar el depósito: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [currentUser, deposit, editableData, isProcessing, onClose, onUpdateDeposit]);

  // ─── Restaurar a pendiente ───────────────────────────────────────────────────
  const handleRestoreToPending = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const payload = buildUpdatePayload({ estado: "recibido", motivo_rechazo: null, validado_por: null, fecha_validacion: null });
    try {
      const response = await apiPut(`/depositos/${deposit.id}`, payload);
      if (response.error) throw new Error(response.error);
      onUpdateDeposit({ ...deposit, ...payload });
      setCheckResult({ checked: false, isDuplicate: false, message: "" });
      setDuplicateDeposits([]);
      alert("✅ Depósito restaurado a pendiente correctamente.");
      onClose();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [buildUpdatePayload, deposit, isProcessing, onClose, onUpdateDeposit]);

  // ─── Pendiente de regularizar (flag independiente) ──────────────────────────
  // Marca/desmarca el depósito para que su voucher (formato inválido) se
  // reemplace luego por uno válido. NO cambia el estado del depósito.
  const [isRegularizing, setIsRegularizing] = useState(false);

  const handleToggleRegularizePending = useCallback(async () => {
    if (isRegularizing) return;
    const nuevo = !deposit.pendiente_regularizar;

    setIsRegularizing(true);
    // Actualización optimista
    onUpdateDeposit({ ...deposit, pendiente_regularizar: nuevo }, { skipPersist: true });

    try {
      await markDepositRegularizePending(deposit.id, nuevo);
    } catch (err) {
      onUpdateDeposit({ ...deposit, pendiente_regularizar: !nuevo }, { skipPersist: true });
      alert(`❌ No se pudo actualizar la marca: ${err.message}`);
    } finally {
      setIsRegularizing(false);
    }
  }, [deposit, isRegularizing, onUpdateDeposit]);

  // Sube el voucher válido que reemplaza la imagen y limpia la marca.
  const handleUploadRegularizeVoucher = useCallback(
    async (file) => {
      if (!file || isRegularizing) return;

      if (!file.type.startsWith("image/")) {
        alert("Selecciona un archivo de imagen válido (JPG/PNG).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("La imagen debe pesar 5 MB o menos.");
        return;
      }

      setIsRegularizing(true);
      try {
        const base64 = await fileToBase64(file);
        const result = await uploadRegularizeVoucher(deposit.id, base64);
        onUpdateDeposit(
          {
            ...deposit,
            pendiente_regularizar: false,
            imagen_voucher: result?.imagenVoucher || deposit.imagen_voucher,
          },
          { skipPersist: true },
        );
        alert("✅ Voucher reemplazado. Depósito regularizado.");
        onClose();
      } catch (err) {
        alert(`❌ No se pudo subir el voucher: ${err.message}`);
      } finally {
        setIsRegularizing(false);
      }
    },
    [deposit, isRegularizing, onClose, onUpdateDeposit],
  );

  // ─── Guardar cambios (sin confirmar) ────────────────────────────────────────
  const handleSaveChanges = useCallback(() => {
    onUpdateDeposit({
      ...deposit,
      empresa_id: editableData.empresa_id || null,
      banco_id: editableData.banco_id || null,
      anexo: editableData.anexo || null,
    });
    onClose();
  }, [deposit, editableData, onClose, onUpdateDeposit]);

  return {
    // Estado
    isChecking,
    isProcessing,
    isSending,
    isRegularizing,
    checkResult,
    setCheckResult,
    duplicateDeposits,
    isRejectionModalOpen,
    setIsRejectionModalOpen,
    // Derivados
    canConfirm,
    canCheckDuplicates,
    // Handlers
    buildUpdatePayload,
    handleCheckDuplicates,
    handleToggleEsAntiguo,
    handleConfirmDeposit,
    handleConfirmRejection,
    handleRestoreToPending,
    handleSaveChanges,
    handleToggleRegularizePending,
    handleUploadRegularizeVoucher,
  };
}
