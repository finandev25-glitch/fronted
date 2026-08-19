import { useState, useCallback } from "react";
import { apiPut } from "../../../services/backendApi.js";
import {
  checkDuplicate,
  confirmDeposit,
  rejectDeposit,
  fetchDepositById,
} from "../../deposits/api/depositsApi.js";

// "MN" = moneda nacional (Soles), "ME" = moneda extranjera (Dólares) --
// mismo criterio que useDepositForm.js (anexoMonedaWarning) y el side panel
// de AppExtension (checkAnexoMonedaMismatch en sidepanel.js).
const ANEXO_SUFFIX_TO_MONEDA = { MN: "PEN", ME: "USD" };
const MONEDA_LABEL = { PEN: "Soles (PEN)", USD: "Dólares (USD)" };

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
  allDeposits = [],
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
        // "numero_operacion" (sin "_banco") es el campo que de verdad lee el
        // resto de la app (tarjetas del Kanban, etc.) -- mapea a la columna
        // real Deposito.NumeroOperacion. Se refleja acá para que la
        // actualización optimista se vea correcta hasta el próximo refetch
        // (que ya va a traer el valor limpio que aplicó el backend).
        numero_operacion: editableData.numero_operacion_banco || null,
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

  // Todos los campos editables del modal, en la forma que espera confirmDeposit/
  // rejectDeposit -- se usa tanto al confirmar como al rechazar, porque lo que
  // trajo el OCR/IA al crear el depósito no necesariamente es correcto y
  // finanzas puede corregir cualquiera de estos antes de resolverlo (antes solo
  // viajaban "anexo" y "observaciones", el resto se descartaba en el cliente).
  const buildEditableFieldsForRequest = useCallback(
    () => ({
      anexo: editableData.anexo || undefined,
      numeroOperacion: editableData.numero_operacion_banco || undefined,
      empresaId: editableData.empresa_id || undefined,
      bancoId: editableData.banco_id || undefined,
      monto: editableData.monto || undefined,
      moneda: selectedMoneda || undefined,
      fechaDeposito: editableData.fecha_deposito || undefined,
      cliente: editableData.cliente || undefined,
      rucCliente: editableData.ruc_cliente || undefined,
      referenciaCliente: editableData.referencia_cliente || undefined,
    }),
    [editableData, selectedMoneda],
  );

  // ─── Comprobar duplicados ────────────────────────────────────────────────────

  const handleCheckDuplicates = useCallback(async () => {
    if (!canCheckDuplicates) {
      setCheckResult({
        checked: true,
        isDuplicate: true,
        message: "Completa empresa, banco, anexo, moneda, importe, nro. de operación y fecha de depósito antes de comprobar duplicados.",
      });
      return;
    }

    // Anexo termina en "MN" (Soles) o "ME" (Dólares) -- si no coincide con
    // la Moneda elegida, no tiene sentido ni buscar duplicados ni dejar
    // confirmar: casi seguro alguien se equivocó de anexo o de moneda. Se
    // reutiliza isDuplicate=true para bloquear "Confirmar" (canConfirm ya
    // exige !isDuplicate) sin tener que agregar un estado aparte.
    const anexoSuffix = String(editableData.anexo || "").trim().toUpperCase().slice(-2);
    const expectedMoneda = ANEXO_SUFFIX_TO_MONEDA[anexoSuffix];
    if (expectedMoneda && selectedMoneda && expectedMoneda !== selectedMoneda) {
      setCheckResult({
        checked: true,
        isDuplicate: true,
        message: `⚠️ El anexo "${editableData.anexo}" es de ${MONEDA_LABEL[expectedMoneda]}, pero la moneda elegida es ${MONEDA_LABEL[selectedMoneda] || selectedMoneda}. Corregilo antes de confirmar.`,
      });
      return;
    }

    setIsChecking(true);
    setCheckResult({ checked: false, isDuplicate: false, message: "" });

    try {
      // Búsqueda en TODA la base de datos (backend): mismo importe + moneda +
      // operación. Cada duplicado se enriquece con los datos completos del
      // listado ya cargado cuando está disponible (el backend puede devolver
      // el depósito con campos incompletos).
      const response = await checkDuplicate({
        monto: editableData.monto,
        moneda: selectedMoneda,
        numeroOperacion: editableData.numero_operacion_banco,
        excludeId: deposit.id,
      });

      if (response.error) {
        setCheckResult({ checked: true, isDuplicate: true, message: "Error al comprobar: " + response.error });
        return;
      }

      // El backend solo devuelve id + sucursal + trabajador de cada duplicado.
      // Para mostrar empresa, banco, nro. operación, importe y fechas, traemos
      // el DETALLE COMPLETO de cada uno por su id (o lo tomamos del listado ya
      // cargado si está disponible). La sucursal/personal que sí trae el
      // duplicado se conservan como respaldo.
      const rawDuplicates = response.duplicates || [];
      const duplicates = await Promise.all(
        rawDuplicates.map(async (dup) => {
          const local = (allDeposits || []).find(
            (d) => String(d.id) === String(dup.id),
          );
          // Si el registro local ya trae la imagen del voucher, lo usamos tal
          // cual. Si NO la trae (la lista del kanban a veces no incluye el
          // voucher), traemos el detalle completo para poder mostrar el
          // comprobante en la card del duplicado.
          if (local && local.imagen_voucher) {
            return {
              ...local,
              sucursal: local.sucursal || dup.sucursal || null,
              trabajador: local.trabajador || dup.trabajador || null,
            };
          }
          try {
            const full = await fetchDepositById(dup.id);
            if (full) {
              return {
                ...(local || {}),
                ...full,
                imagen_voucher: full.imagen_voucher || local?.imagen_voucher || null,
                sucursal: full.sucursal || local?.sucursal || dup.sucursal || null,
                trabajador: full.trabajador || local?.trabajador || dup.trabajador || null,
              };
            }
          } catch {
            // Si falla el detalle, se muestra el duplicado con lo que trae.
          }
          if (local) {
            return {
              ...local,
              sucursal: local.sucursal || dup.sucursal || null,
              trabajador: local.trabajador || dup.trabajador || null,
            };
          }
          return dup;
        }),
      );

      if (duplicates.length > 0) {
        setDuplicateDeposits(duplicates);
        setCheckResult({
          checked: true,
          isDuplicate: true,
          message: `¡Alerta! Se encontraron ${duplicates.length} depósito(s) duplicado(s).`,
        });
      } else {
        setDuplicateDeposits([]);
        setCheckResult({
          checked: true,
          isDuplicate: false,
          message: "No se encontraron duplicados. Puede confirmar el depósito.",
        });
      }
    } catch (err) {
      setCheckResult({ checked: true, isDuplicate: true, message: "Error crítico: " + err.message });
    } finally {
      setIsChecking(false);
    }
  }, [canCheckDuplicates, deposit?.id, editableData, selectedMoneda, allDeposits]);

  // ─── Confirmar depósito ───────────────────────────────────────────────────────
  // Devuelve { success, error? } en vez de usar window.alert(): además de que
  // alert()/confirm() no se ve de forma confiable dentro de un side panel de
  // extensión, es un diálogo nativo feo con el nombre de la extensión en el
  // título -- DepositDetailModal usa este valor de retorno para mostrar su
  // propio modal/toast, tanto en la Ventana de validación (panel compacto)
  // como en el modal completo.
  const handleConfirmDeposit = useCallback(async () => {
    if (!checkResult.checked) {
      return { success: false, error: "Primero debes comprobar duplicados." };
    }
    if (checkResult.isDuplicate) {
      return { success: false, error: "No puedes confirmar mientras el depósito esté marcado como duplicado." };
    }

    const missing = [];
    if (!editableData.empresa_id) missing.push("Empresa");
    if (!editableData.banco_id) missing.push("Banco");
    if (!editableData.anexo) missing.push("Anexo");
    if (!selectedMoneda) missing.push("Moneda");
    if (missing.length > 0) {
      return { success: false, error: `Por favor, complete los campos requeridos: ${missing.join(", ")}` };
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
        ...buildEditableFieldsForRequest(),
      });

      const payload = buildUpdatePayload({
        estado: "confirmado",
        motivo_rechazo: null,
        validado_por: currentUser.id,
        fecha_validacion: new Date().toISOString(),
      });

      onUpdateDeposit({ ...deposit, ...payload }, { skipPersist: true });
      // NO cerramos el modal al confirmar: se queda abierto para que, ya
      // confirmado, aparezca el botón "Regularizar" y se pueda marcar si el
      // voucher hay que reemplazarlo.
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setIsSending(false);
      setIsProcessing(false);
    }
  }, [buildEditableFieldsForRequest, buildUpdatePayload, checkResult, currentUser, deposit, editableData, onClose, onUpdateDeposit, selectedMoneda]);

  // ─── Rechazar depósito ───────────────────────────────────────────────────────
  // FIX: ahora llama al endpoint real POST /v1/deposits/{id}/reject, que
  // exige "observaciones" en el body (antes esto tambien era 100% local).
  const handleConfirmRejection = useCallback(async (reason) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await rejectDeposit(deposit.id, {
        observaciones: reason,
        ...buildEditableFieldsForRequest(),
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
  }, [buildEditableFieldsForRequest, currentUser, deposit, editableData, isProcessing, onClose, onUpdateDeposit]);

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
    handleConfirmDeposit,
    handleConfirmRejection,
    handleRestoreToPending,
    handleSaveChanges,
  };
}
