import { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { AuthContext } from "../../auth/context/AuthContext.jsx";
import { fetchCuentas } from "../../deposits/api/depositsApi.js";
import {
  normalizeDepositCurrency,
  normalizeDateForInput,
  getSqlServerCompanyConfigFromEmpresaId,
  sortAnexosForBancoEmpresa,
} from "../../deposits/components/depositDetailModalHelpers.jsx";

// "MN" = moneda nacional (Soles), "ME" = moneda extranjera (Dólares) --
// mismo criterio que ya usa el side panel de AppExtension
// (checkAnexoMonedaMismatch en sidepanel.js).
const ANEXO_SUFFIX_TO_MONEDA = { MN: "PEN", ME: "USD" };

/**
 * Hook central que gestiona el estado editable de un depósito.
 *
 * FIX 1: usa lastInitializedDepositId para que las actualizaciones de
 * WebSocket no sobreescriban lo que el usuario ya seleccionó.
 *
 * FIX 2: el Kanban abre el modal de forma optimista con la versión resumida
 * del depósito (GET /v1/deposits, que nunca trae imagen/empresa/anexo) y en
 * paralelo pide GET /v1/deposits/{id} para el detalle completo. hasFullDetail
 * usa la presencia de imagen_voucher como señal de "ya llegó el detalle
 * completo": es el único campo que solo viene en esa respuesta (el listado
 * jamás lo incluye) y todo depósito real tiene una imagen de voucher, así que
 * no da falsos positivos como sí los daría mirar empresa/banco (esos pueden
 * venir poblados desde antes por cruce con catálogo en la tarjeta resumida,
 * aunque el detalle real todavía no haya llegado).
 *
 * También carga Anexos desde el backend (no del prop local `cuentas`).
 */
export function useDepositForm({ deposit, empresas, bancos, queueItem }) {
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

  // Aviso (no bloqueante) cuando el Anexo recién elegido no coincide con la
  // Moneda ya seleccionada -- se compara por los últimos 2 caracteres del
  // anexo: "MN" (moneda nacional) = PEN, "ME" (moneda extranjera) = USD.
  // No se corrige nada solo, el usuario decide cuál de los dos estaba mal.
  // Objeto nuevo en cada aviso (no un booleano) para que un efecto en el
  // componente pueda mostrar el toast solo cuando cambia, sin re-disparar en
  // cada render.
  const [anexoMonedaWarning, setAnexoMonedaWarning] = useState(null);

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

  const hasFullDetail = Boolean(
    deposit?.imagen_voucher || deposit?.imagenUrl || deposit?.imagenVoucher
  );

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
      hasHydratedRelations.current = hasFullDetail;
      return;
    }

    // Mismo depósito: si todavía no habíamos recibido el detalle completo
    // (veníamos de la versión resumida del Kanban) y ya llegó, rellenamos
    // ahora — pero solo los campos que el usuario no haya tocado todavía.
    if (!hasHydratedRelations.current && hasFullDetail) {
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
  }, [deposit, hasFullDetail]);

  // ─── Reaplicar ediciones del side panel mientras el modal ya está abierto ──
  // KanbanPage.handleCardClick ya fusiona las ediciones de la cola (extensión)
  // en `deposit` ANTES de abrir el modal, así que el useEffect de arriba las
  // toma de ahí para la carga inicial. Pero para el MISMO deposit.id, ese
  // useEffect ya no vuelve a tocar fecha/monto/moneda/cliente/anexo/banco
  // (a propósito, FIX 1: no pisar lo que el usuario ya tipeó a mano). Sin este
  // efecto aparte, si el usuario edita ese mismo depósito desde el side panel
  // de la extensión con el modal todavía abierto, el formulario queda
  // "congelado" en lo que tenía al abrir. queueItem llega como prop (ver
  // DepositDetailModal → KanbanPage, que lo saca de depositQueue.queueItems).
  //
  // Depende del ITEM completo de la cola, no solo de depositData: al tocar
  // "Atender" en el side panel, background.js arma un item nuevo pero
  // reutiliza la misma referencia de depositData (no cambió ningún campo) --
  // si el efecto dependiera solo de depositData, ese click no dispararía
  // ningún resync. Comparando el item entero, cualquier cambio en la cola
  // (edición de campo O click en Atender) re-sincroniza el formulario.
  const lastAppliedQueueItemRef = useRef(null);

  useEffect(() => {
    const queueEdits = queueItem?.depositData;
    if (!queueEdits) {
      lastAppliedQueueItemRef.current = null;
      return;
    }
    if (lastAppliedQueueItemRef.current === queueItem) return;
    lastAppliedQueueItemRef.current = queueItem;

    setEditableData((prev) => ({
      ...prev,
      fecha_deposito: queueEdits.fecha_deposito
        ? normalizeDateForInput(queueEdits.fecha_deposito)
        : prev.fecha_deposito,
      numero_operacion_banco: queueEdits.numero_operacion_solicitante || prev.numero_operacion_banco,
      monto:
        queueEdits.monto !== undefined && queueEdits.monto !== "" ? queueEdits.monto : prev.monto,
      moneda: queueEdits.moneda ? normalizeDepositCurrency(queueEdits.moneda) : prev.moneda,
      cliente: queueEdits.cliente || prev.cliente,
      anexo: queueEdits.anexo || prev.anexo,
      banco_id: queueEdits.bancoId || prev.banco_id,
    }));
  }, [queueItem]);

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
        // BCP pide un orden fijo de Anexo, distinto por empresa (JCH vs
        // Evolution) -- ver sortAnexosForBancoEmpresa. Para cualquier otro
        // banco esto es un no-op (devuelve `anexos` tal cual).
        const bancoAbreviatura = bancos.find(
          (b) => String(b.id) === String(editableData.banco_id),
        )?.abreviatura;
        const { empresa: empresaCode } = getSqlServerCompanyConfigFromEmpresaId(
          editableData.empresa_id,
          empresas,
        );
        setFilteredAnexos(sortAnexosForBancoEmpresa(anexos, { bancoAbreviatura, empresaCode }));
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

    // Anexo termina en "MN" (Soles) o "ME" (Dólares) -- si no coincide con
    // la Moneda que ya estaba elegida, es casi seguro que alguien se
    // equivocó de anexo o de moneda (no se corrige solo, ver
    // anexoMonedaWarning más arriba).
    if (name === "anexo") {
      const suffix = String(value || "").trim().toUpperCase().slice(-2);
      const expectedMoneda = ANEXO_SUFFIX_TO_MONEDA[suffix];
      const currentMoneda = editableData.moneda;
      if (expectedMoneda && currentMoneda && currentMoneda !== expectedMoneda) {
        setAnexoMonedaWarning({ anexo: value, expectedMoneda, currentMoneda });
      }
    }

    setEditableData((prev) => {
      // Al cambiar el banco, resetear el anexo
      if (name === "banco_id") {
        return { ...prev, banco_id: cleanedValue, anexo: "" };
      }
      return { ...prev, [name]: cleanedValue };
    });
  }, [editableData.moneda]);

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
    anexoMonedaWarning,
    selectedMoneda,
    selectedBanco,
    activeEmpresas,
    activeBancos,
    voucherUrl,
    isBackendConnected,
    currentUser,
    // true recien cuando llego el detalle completo (GET /v1/deposits/{id}),
    // no con la version resumida del listado del Kanban. La UI lo usa para
    // mostrar un loader en vez de un formulario a medias con bordes rojos.
    isDetailLoaded: hasFullDetail,
    // Handlers
    handleChange,
    handleFileSelectFromPicker,
    handleFileSelect,
  };
}
