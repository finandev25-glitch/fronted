import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAllDeposits,
  fetchDepositsByDate,
  fetchDepositsByPeriod,
  updateDeposit as persistDepositUpdate,
  lockDeposit,
  unlockDeposit,
} from "../api/depositsApi.js";

export function useDepositRecords({
  currentUser,
  users,
  personal,
  bancos,
  empresas,
  sucursales,
  isAuthenticated,
  showPendingDepositNotification,
}) {
  const [deposits, setDeposits] = useState([]);
  const [currentSelectedDate, setCurrentSelectedDate] = useState(null);
  const [realtimeActivity, setRealtimeActivity] = useState(null);

  const currentUserRef = useRef(currentUser);
  const currentSelectedDateRef = useRef(currentSelectedDate);
  const depositsRef = useRef([]);
  const lastQueryRef = useRef({ type: null, value: null });

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    currentSelectedDateRef.current = currentSelectedDate;
  }, [currentSelectedDate]);

  useEffect(() => {
    depositsRef.current = deposits;
  }, [deposits]);

  const pendingWorkloadCount = useMemo(
    () => deposits.filter((deposit) => deposit?.estado === "recibido").length,
    [deposits]
  );

  const mergeDepositRecord = useCallback((existing = {}, incoming = {}) => {
    const merged = { ...existing, ...incoming };

    ["empresa", "banco", "sucursal", "trabajador", "validado_por_usuario"].forEach((field) => {
      const incomingValue = incoming[field];
      const existingValue = existing[field];

      if (incomingValue && typeof incomingValue === "object" && !Array.isArray(incomingValue)) {
        merged[field] = {
          ...(existingValue && typeof existingValue === "object" ? existingValue : {}),
          ...incomingValue,
        };
      } else if (existingValue && typeof existingValue === "object" && incomingValue == null) {
        merged[field] = existingValue;
      }
    });

    return merged;
  }, []);

  const loadAllDeposits = useCallback(async () => {
    const data = await fetchAllDeposits();
    setDeposits(data);
    setCurrentSelectedDate(null);
    lastQueryRef.current = { type: "all", value: null };
    return data;
  }, []);

  const loadDepositsByDate = useCallback(async (date) => {
    if (!date) {
      return loadAllDeposits();
    }

    const data = await fetchDepositsByDate(date);
    setDeposits(data);
    setCurrentSelectedDate(date);
    lastQueryRef.current = { type: "date", value: date };
    return data;
  }, [loadAllDeposits]);

  const loadDepositsByPeriod = useCallback(async (period) => {
    const data = await fetchDepositsByPeriod(period);
    setDeposits(data);
    setCurrentSelectedDate(null);
    lastQueryRef.current = { type: "period", value: period };
    return data;
  }, []);

  const refreshDeposits = useCallback(async () => {
    try {
      const lastQuery = lastQueryRef.current;

      if (lastQuery.type === "date" && lastQuery.value) {
        return await loadDepositsByDate(lastQuery.value);
      }

      if (lastQuery.type === "period" && lastQuery.value) {
        return await loadDepositsByPeriod(lastQuery.value);
      }

      return await loadAllDeposits();
    } catch (error) {
      console.warn("Error al refrescar depositos:", error.message);
      return [];
    }
  }, [loadAllDeposits, loadDepositsByDate, loadDepositsByPeriod]);

  const handleRealtimeInsert = useCallback((newRecord) => {
    setRealtimeActivity({
      type: "update",
      count: 1,
      depositId: null,
      at: Date.now(),
    });

    if (newRecord?.estado === "recibido") {
      void showPendingDepositNotification(newRecord);
    }

    refreshDeposits();
  }, [refreshDeposits, showPendingDepositNotification]);

  const handleRealtimeUpdate = useCallback((fullDeposit) => {
    if (!fullDeposit) return;

    const previousDeposit = depositsRef.current.find((deposit) => deposit.id === fullDeposit.id) || null;
    const isEnteringPending =
      fullDeposit.estado === "recibido" && previousDeposit?.estado !== "recibido";

    if (isEnteringPending) {
      void showPendingDepositNotification(fullDeposit);
    }

    setRealtimeActivity({
      type: "update",
      count: 1,
      depositId: fullDeposit.id,
      at: Date.now(),
    });

    setDeposits((prev) => {
      const exists = prev.some((deposit) => deposit.id === fullDeposit.id);
      if (exists) {
        return prev.map((deposit) =>
          deposit.id === fullDeposit.id ? mergeDepositRecord(deposit, fullDeposit) : deposit
        );
      }

      setTimeout(() => refreshDeposits(), 0);
      return prev;
    });
  }, [mergeDepositRecord, refreshDeposits, showPendingDepositNotification]);

  const handleRealtimeDelete = useCallback((deletedId) => {
    if (!deletedId) return;

    setRealtimeActivity({
      type: "delete",
      count: 1,
      depositId: deletedId,
      at: Date.now(),
    });

    setDeposits((prev) => prev.filter((deposit) => deposit.id !== deletedId));
  }, []);

  const handleSelectedDateChange = useCallback((fecha) => {
    setCurrentSelectedDate(fecha);
  }, []);

  const handleSelectDate = useCallback(async (fecha) => {
    if (!currentUserRef.current) return;

    if (!fecha) {
      await loadAllDeposits();
      return;
    }

    await loadDepositsByDate(fecha);
  }, [loadAllDeposits, loadDepositsByDate]);

  // skipPersist=true: usar cuando quien llama YA hizo la llamada real al
  // backend (confirm/reject/lock) y solo necesita reflejar el resultado en
  // el estado local, sin que esto dispare OTRA vez el dispatcher generico
  // de persistDepositUpdate (que ademas no soporta "rechazado"/"procesado").
  const handleUpdateDeposit = useCallback(async (updatedDeposit, { skipPersist = false } = {}) => {
    setDeposits((prev) => prev.map((deposit) => (deposit.id === updatedDeposit.id ? updatedDeposit : deposit)));

    if (skipPersist) return updatedDeposit;

    try {
      const {
        id,
        empresa,
        banco,
        sucursal,
        trabajador,
        validado_por_usuario,
        ...payload
      } = updatedDeposit;

      void empresa;
      void banco;
      void sucursal;
      void trabajador;
      void validado_por_usuario;

      const data = await persistDepositUpdate(id, payload);
      setDeposits((prev) => prev.map((deposit) => (deposit.id === id ? data : deposit)));
      return data;
    } catch (error) {
      console.error("Error en handleUpdateDeposit:", error);
      return null;
    }
  }, []);

  // FIX: antes esto era 100% local — inventaba un estado "en_validacion" que
  // no existe en el backend (Deposito solo usa recibido/procesado/rechazado/
  // confirmado) y llamaba a persistDepositUpdate, que ni siquiera sabe manejar
  // esa transicion (siempre fallaba silenciosamente contra el backend real).
  // Ahora llama al endpoint real POST /v1/deposits/{id}/lock: el deposito se
  // queda en estado "procesado", solo se marca "validado_por" = usuario actual
  // para que nadie mas pueda confirmarlo/rechazarlo mientras lo tiene tomado
  // (el backend rechaza confirm/reject de otro usuario mientras ValidadoPor
  // este seteado).
  const handleTakeDepositForValidation = useCallback(async (deposit) => {
    if (!currentUserRef.current) return null;

    // Proteccion en el cliente: el endpoint de lock del backend NO valida si
    // el deposito ya esta tomado por otro usuario (solo revisa que el estado
    // sea "procesado"), asi que evitamos siquiera intentarlo si ya vemos que
    // "validado_por" pertenece a alguien mas.
    if (
      deposit.validado_por &&
      String(deposit.validado_por).toLowerCase() !== String(currentUserRef.current.id).toLowerCase()
    ) {
      alert("Este depósito ya está siendo validado por otro usuario.");
      return null;
    }

    try {
      await lockDeposit(deposit.id);
      const updatedDeposit = {
        ...deposit,
        validado_por: currentUserRef.current.id,
        fecha_validacion: new Date().toISOString(),
      };
      setDeposits((prev) => prev.map((item) => (item.id === deposit.id ? { ...item, ...updatedDeposit } : item)));
      return updatedDeposit;
    } catch (error) {
      alert(`No se pudo tomar el depósito para validación: ${error.message}`);
      return null;
    }
  }, []);

  // Libera el candado cuando el usuario cierra el modal SIN confirmar ni
  // rechazar (para que otro usuario pueda tomarlo). No hace nada si el
  // deposito ya no le pertenece o si ya salio del estado "procesado".
  const handleUnlockDeposit = useCallback(async (deposit) => {
    if (!deposit || !currentUserRef.current) return;
    if (deposit.estado !== "procesado") return;
    if (String(deposit.validado_por || "").toLowerCase() !== String(currentUserRef.current.id).toLowerCase()) return;

    try {
      await unlockDeposit(deposit.id);
      setDeposits((prev) =>
        prev.map((item) => (item.id === deposit.id ? { ...item, validado_por: null } : item))
      );
    } catch (error) {
      console.warn("No se pudo liberar el depósito:", error.message);
    }
  }, []);

  const depositsWithFullData = useMemo(() => {
    if (!deposits) return [];
    if (isAuthenticated) return deposits;

    return deposits.map((deposit) => {
      const trabajador = personal.find((item) => item.id === deposit.trabajador_sucursal_id);
      const validator = users.find((item) => item.id === deposit.validado_por);
      return {
        ...deposit,
        trabajador: trabajador ? { nombre: trabajador.nombre } : null,
        validado_por_usuario: validator ? { nombre: validator.nombre } : null,
        sucursal: { nombre: deposit.sucursal },
        banco: { abreviatura: deposit.banco },
        empresa: { nombre: deposit.empresa },
      };
    });
  }, [deposits, isAuthenticated, personal, users]);

  useEffect(() => {
    if (!currentUser) return;

    if (!currentSelectedDateRef.current && deposits.length > 0 && lastQueryRef.current.type === null) {
      lastQueryRef.current = { type: "all", value: null };
    }
  }, [currentUser, deposits.length]);

  void bancos;
  void empresas;
  void sucursales;

  return {
    deposits,
    depositsWithFullData,
    currentSelectedDate,
    pendingWorkloadCount,
    realtimeActivity,
    refreshDeposits,
    fetchDepositsByDate: loadDepositsByDate,
    fetchAllDeposits: loadAllDeposits,
    fetchDepositsByPeriod: loadDepositsByPeriod,
    handleRealtimeInsert,
    handleRealtimeUpdate,
    handleRealtimeDelete,
    handleSelectedDateChange,
    handleSelectDate,
    handleUpdateDeposit,
    handleTakeDepositForValidation,
    handleUnlockDeposit,
  };
}

export default useDepositRecords;
