import { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { AuthContext } from "../../auth/context/AuthContext.jsx";
import { fetchCuentas } from "../../deposits/api/depositsApi.js";
import { normalizeDepositCurrency, normalizeDateForInput } from "../../deposits/components/depositDetailModalHelpers.jsx";

/**
 * Hook central que gestiona el estado editable de un depósito.
 *
 * FIX 1: usa lastInitializedDepositId para que las actualizaciones de
 * WebSocket no sobreescriban lo que el usuario ya seleccionó.
 *
 * FIX 2: hasHydratedRelations rellena empresa_id/banco_id/anexo/etc. cuando
 * llega el detalle completo del depósito (GET /v1/deposits/{id}) después de
 * que el Kanban ya abrió el modal con la versión resumida — sin este fix,
 * esos campos se quedaban vacíos para siempre y el select de Anexo nunca
 * cargaba opciones (dependía de empresa_id/banco_id).
 *
 * También carga Anexos desde el backend (no del prop local `cuentas`).
 */
export function useDepositForm({ deposit, empresas, bancos }) {
  const { currentUser } = useContext(AuthContext);
  const isBackendConnected = !!currentUser;

  // ─── Estado del formulario ──────────────────────────────────────────────────
  const [editableData, setEditableData] = useState({
    empresa_id: "",
    banco_id: "",
    anexo: "",
    monto: 0,
    moneda: "PEN",
    numero_operacion_banco: "",
    fecha_deposito: "",
    imagen_voucher: "",
    cliente: "",
    ruc_cliente: "",
    observaciones: "",
    referencia_cliente: "",
  });

  const [filteredAnexos, setFilteredAnexos] = useState([]);

  // ─── Inicialización del formulario ──────────────────────────────────────────
  // lastInitializedDepositId evita que el WebSocket, al actualizar el depósito,
  // sobreescriba los campos que el usuario ya editó manualmente.
  const lastInitializedDepositId = useRef(null);

  // El Kanban abre el modal de forma optimista con la versión resumida del
  // depósito (sin empresa/banco/anexo) y, en paralelo, pide GET /v1/deposits/{id}
  // para traer el detalle completo, fusionándolo en el mismo `deposit.id`.
  // hasHydratedRelations distingue "ya inicialicé este depósito" (no reescribir
  // lo que el usuario tocó) de "todavía no llegaron empresa/banco/anexo del
  // detalle completo" (sí hay que rellenarlos en cuanto lleguen).
  const hasHydratedRelations = useRef(false);

  useEffect(() => {
    if (!deposit) return;

    if (lastInitializedDepositId.current !== deposit.id) {
      // Depósito nuevo: inicializamos todo el formulario desde cero.
      setEditableData({
        // FIX: deposit.empresa?.id para cuando el backend incluye el objeto completo,
        //      deposit.empresa_id para cuando solo envía el campo plano (WebSocket, etc.)
        empresa_id: deposit.empresa?.id || deposit.empresa_id || "",
        banco_id: deposit.banco?.id || deposit.banco_id || "",
        anexo: deposit.anexo || "",
        monto: deposit.monto || 0,
        moneda: normalizeDepositCurrency(deposit.moneda),
        numero_operacion_banco: deposit.numero_operacion_banco || deposit.numero_operacion || "",
        fecha_deposito: normalizeDateForInput(deposit.fecha_deposito),
        imagen_voucher: deposit.imagen_voucher || deposit.imagenUrl || deposit.imagenVoucher || "",
        cliente: deposit.cliente || "",
        ruc_cliente: deposit.ruc_cliente || "",
        observaciones: deposit.observaciones || "",
        referencia_cliente: deposit.referencia_cliente || "",
      });

      lastInitializedDepositId.current = deposit.id;
      hasHydratedRelations.current = Boolean(deposit.empresa?.id || deposit.banco?.id);
      return;
    }

    // Mismo depósito: si todavía no habíamos recibido empresa/banco (veníamos
    // de la versión resumida del Kanban) y ya llegaron, los rellenamos ahora
    // — pero solo los campos que el usuario no haya tocado todavía.
    if (!hasHydratedRelations.current && (deposit.empresa?.id || deposit.banco?.id)) {
      hasHydratedRelations.current = true;
      setEditableData((prev) => ({
        ...prev,
        empresa_id: prev.empresa_id || deposit.empresa?.id || deposit.empresa_id || "",
        banco_id: prev.banco_id || deposit.banco?.id || deposit.banco_id || "",
        anexo: prev.anexo || deposit.anexo || "",
        imagen_voucher:
          prev.imagen_voucher || deposit.imagen_voucher || deposit.imagenUrl || deposit.imagenVoucher || "",
        ruc_cliente: prev.ruc_cliente || deposit.ruc_cliente || "",
        referencia_cliente: prev.referencia_cliente || deposit.referencia_cliente || "",
      }));
    }
  }, [deposit]);

  // ─── Cargar Anexos desde el backend ────────────────────────────────────────
  // Usamos el endpoint real en lugar del prop `cuentas` local que puede estar vacío
  useEffect(() => {
    let isMounted = true;

    async function loadAnexos() {
      if (!editableData.empresa_id || !editableData.banco_id) {
        if (isMounted) setFilteredAnexos([]);
        return;
      }
      try {
        const cuentas = await fetchCuentas(editableData.empresa_id, editableData.banco_id);
        if (!isMounted) return;
        const anexos = [...new Set(cuentas.map((c) => c.anexo || c.Anexo))].filter(Boolean);
        setFilteredAnexos(anexos);
      } catch (err) {
        console.error("Error cargando anexos:", err);
        if (isMounted) setFilteredAnexos([]);
      }
    }

    loadAnexos();
    return () => { isMounted = false; };
  }, [editableData.empresa_id, editableData.banco_id]);

  // ─── Handler genérico de cambios ────────────────────────────────────────────
  const handleFileSelectFromPicker = useCallback((url) => {
    setEditableData((prev) => ({ ...prev, imagen_voucher: url }));
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;

    let cleanedValue = value;
    if (name === "numero_operacion_banco") {
      cleanedValue = value.replace(/\D/g, "");
    } else if (name === "moneda") {
      cleanedValue = normalizeDepositCurrency(value);
    }

    setEditableData((prev) => {
      // Al cambiar el banco, resetear el anexo
      if (name === "banco_id") {
        return { ...prev, banco_id: cleanedValue, anexo: "" };
      }
      return { ...prev, [name]: cleanedValue };
    });
  }, []);

  const handleFileSelect = useCallback((url) => {
    setEditableData((prev) => ({ ...prev, imagen_voucher: url }));
  }, []);

  // ─── Valores derivados ──────────────────────────────────────────────────────
  const selectedMoneda = normalizeDepositCurrency(editableData.moneda);

  const selectedBanco = useMemo(() => {
    const bancoId = editableData.banco_id || deposit?.banco?.id || "";
    return bancos.find((b) => String(b.id) === String(bancoId)) || deposit?.banco || null;
  }, [bancos, deposit?.banco, editableData.banco_id]);

  const activeEmpresas = useMemo(() => empresas.filter((e) => e.estado === "activo"), [empresas]);
  const activeBancos = useMemo(() => bancos.filter((b) => b.estado === "activo"), [bancos]);

  // URL del voucher normalizada (Google Drive → preview)
  const voucherUrl = useMemo(() => {
    let url = editableData.imagen_voucher || deposit?.imagen_voucher || "";
    if (url && url.includes("drive.google.com/file/d/")) {
      const fileId = url.split("/d/")[1].split("/")[0];
      url = `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
  }, [editableData.imagen_voucher, deposit?.imagen_voucher]);

  return {
    // Estado
    editableData,
    setEditableData,
    filteredAnexos,
    selectedMoneda,
    selectedBanco,
    activeEmpresas,
    activeBancos,
    voucherUrl,
    isBackendConnected,
    currentUser,
    // Handlers
    handleChange,
    handleFileSelectFromPicker,
    handleFileSelect,
  };
}
