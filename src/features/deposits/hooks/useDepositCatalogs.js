import { useCallback, useState } from "react";
import {
  createBanco,
  createCuenta,
  createEmpresa,
  createPersonal,
  createSucursal,
  deleteBanco,
  deleteCuenta,
  deletePersonal,
  fetchBancos,
  fetchCuentas,
  fetchDashboardBootstrap,
  fetchEmpresas,
  fetchPersonal,
  fetchSucursales,
  updateBanco,
  updateCuenta,
  updateEmpresa,
  updatePersonal,
  updateSucursal,
} from "../api/depositsApi.js";

export function useDepositCatalogs() {
  const [bancos, setBancos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [appDataLoading, setAppDataLoading] = useState(true);
  const [appDataError, setAppDataError] = useState(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setAppDataLoading(true);
    }

    setAppDataError(null);

    try {
      const data = await fetchDashboardBootstrap();
      setBancos(data.bancos || []);
      setEmpresas(data.empresas || []);
      setCuentas(data.cuentas || []);
      setSucursales(data.sucursales || []);
      setPersonal(data.personal || []);
      return data;
    } catch (error) {
      setAppDataError(error.message);
      return null;
    } finally {
      setAppDataLoading(false);
    }
  }, []);

  const fetchBancosData = useCallback(async () => {
    const data = await fetchBancos();
    setBancos(data);
    return data;
  }, []);

  const fetchEmpresasData = useCallback(async () => {
    const data = await fetchEmpresas();
    setEmpresas(data);
    return data;
  }, []);

  const fetchCuentasData = useCallback(async () => {
    const data = await fetchCuentas();
    setCuentas(data);
    return data;
  }, []);

  const fetchSucursalesData = useCallback(async () => {
    const data = await fetchSucursales();
    setSucursales(data);
    return data;
  }, []);

  const fetchPersonalData = useCallback(async (includeInactive = true) => {
    const data = await fetchPersonal(includeInactive);
    setPersonal(data);
    return data;
  }, []);

  const handleAddBanco = useCallback(async (newBancoData) => {
    try {
      const banco = await createBanco(newBancoData);
      setBancos((prev) => [banco, ...prev]);
      return banco;
    } catch (error) {
      alert(`Error: ${error.message}`);
      return null;
    }
  }, []);

  const handleUpdateBanco = useCallback(async (updatedBanco) => {
    try {
      const { id, ...payload } = updatedBanco;
      const banco = await updateBanco(id, payload);
      setBancos((prev) => prev.map((item) => (item.id === id ? banco : item)));
      return banco;
    } catch (error) {
      alert(`Error: ${error.message}`);
      return null;
    }
  }, []);

  const handleDeleteBanco = useCallback(async (bancoId) => {
    try {
      await deleteBanco(bancoId);
      setBancos((prev) => prev.filter((item) => item.id !== bancoId));
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, []);

  const handleAddEmpresa = useCallback(async (newEmpresaData) => {
    try {
      const empresa = await createEmpresa(newEmpresaData);
      setEmpresas((prev) => [...prev, empresa]);
      return empresa;
    } catch (error) {
      alert(`Error: ${error.message}`);
      return null;
    }
  }, []);

  const handleUpdateEmpresa = useCallback(async (empresaId, updatedData) => {
    try {
      // El PUT de /v1/masters/empresas/{id} reemplaza el registro completo,
      // asi que hay que partir del registro actual y aplicarle los cambios
      // parciales (mismo patron que AuthContext.updateUserProfile).
      const existing = empresas.find((item) => item.id === empresaId);
      const merged = { ...existing, ...updatedData };
      const empresa = await updateEmpresa(empresaId, merged);
      setEmpresas((prev) => prev.map((item) => (item.id === empresaId ? empresa : item)));
      return empresa;
    } catch (error) {
      alert(`Error: ${error.message}`);
      return null;
    }
  }, [empresas]);

  const handleAddCuenta = useCallback(async (newCuentaData) => {
    try {
      const cuenta = await createCuenta(newCuentaData);
      setCuentas((prev) => [cuenta, ...prev]);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, []);

  const handleBatchAddCuentas = useCallback((newCuentas) => {
    setCuentas((prev) => [...newCuentas, ...prev]);
  }, []);

  const handleUpdateCuenta = useCallback(async (cuentaId, updatedData) => {
    try {
      // Mismo caso que empresas/sucursales: el PUT reemplaza el registro
      // completo, hay que mezclar con el registro actual primero.
      const existing = cuentas.find((item) => item.id === cuentaId);
      const merged = { ...existing, ...updatedData };
      const cuenta = await updateCuenta(cuentaId, merged);
      setCuentas((prev) => prev.map((item) => (item.id === cuentaId ? cuenta : item)));
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, [cuentas]);

  const handleDeleteCuenta = useCallback(async (cuentaId) => {
    try {
      await deleteCuenta(cuentaId);
      setCuentas((prev) => prev.filter((item) => item.id !== cuentaId));
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, []);

  const handleAddSucursal = useCallback(async (newSucursalData) => {
    try {
      const sucursal = await createSucursal(newSucursalData);
      setSucursales((prev) => [sucursal, ...prev]);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, []);

  const handleUpdateSucursal = useCallback(async (sucursalId, updatedData) => {
    try {
      // El PUT de /v1/masters/sucursales/{id} exige EmpresaId + Nombre +
      // Direccion + Activo completos; se mezcla con el registro actual para
      // poder mandar solo el cambio parcial (toggle de estado, etc).
      const existing = sucursales.find((item) => item.id === sucursalId);
      const merged = { ...existing, ...updatedData };
      const sucursal = await updateSucursal(sucursalId, merged);
      setSucursales((prev) =>
        prev.map((item) => (item.id === sucursalId ? { ...item, ...sucursal } : item))
      );
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, [sucursales]);

  // NOTA: a diferencia de los demas handlers de este hook, este NO atrapa sus
  // propios errores (no hace alert+return null). AddPersonModal necesita
  // distinguir "fallo antes de crear nada" de "el Profile ya se creo pero el
  // Trabajador no se pudo vincular" (flujo de "crear nuevo usuario"), asi que
  // deja que el error se propague hasta el catch del modal, que arma el
  // mensaje correcto segun el caso.
  const handleAddPersonalToSucursal = useCallback(async (sucursalId, personalData) => {
    const nombre = typeof personalData === "string" ? personalData : personalData.nombre;
    let telefono = typeof personalData === "object" ? personalData.telefono : null;
    // "empresa" como texto libre (AddPersonModal, version vieja) no tiene
    // donde ir en el backend: CreateTrabajadorRequest pide un EmpresaId (guid)
    // real, no un nombre. Se resuelve el empresa_id a partir de la sucursal
    // elegida (mapSucursal ya trae empresa_id).
    const profileId = typeof personalData === "object" ? personalData.profileId || personalData.profile_id : null;

    if (telefono && !telefono.startsWith("51")) {
      telefono = `51${telefono}`;
    }

    const sucursal = sucursales.find((item) => item.id === sucursalId);

    const personalRecord = await createPersonal({
      sucursal_id: sucursalId,
      empresa_id: sucursal?.empresa_id,
      nombre,
      estado: "activo",
      telefono_origen: telefono,
      profile_id: profileId,
    });

    setPersonal((prev) => [...prev, personalRecord]);
    return personalRecord;
  }, [sucursales]);

  const handleRemovePersonalFromSucursal = useCallback(async (personalId) => {
    try {
      await deletePersonal(personalId);
      setPersonal((prev) => prev.filter((item) => item.id !== personalId));
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, []);

  const handleUpdatePersonal = useCallback(async (personalId, updates) => {
    try {
      // UpdateTrabajadorRequest tambien reemplaza el registro completo
      // (Nombre/TelefonoPersonal/SucursalId/Activo), se mezcla con el actual.
      const existing = personal.find((item) => item.id === personalId);
      const merged = { ...existing, ...updates };
      const personalRecord = await updatePersonal(personalId, merged);
      setPersonal((prev) =>
        prev.map((item) => (item.id === personalId ? { ...item, ...personalRecord } : item))
      );
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }, [personal]);

  return {
    bancos,
    empresas,
    cuentas,
    sucursales,
    personal,
    appDataLoading,
    appDataError,
    fetchData,
    fetchBancosData,
    fetchEmpresasData,
    fetchCuentasData,
    fetchSucursalesData,
    fetchPersonalData,
    handleAddBanco,
    handleUpdateBanco,
    handleDeleteBanco,
    handleAddEmpresa,
    handleUpdateEmpresa,
    handleAddCuenta,
    handleBatchAddCuentas,
    handleUpdateCuenta,
    handleDeleteCuenta,
    handleAddSucursal,
    handleUpdateSucursal,
    handleAddPersonalToSucursal,
    handleRemovePersonalFromSucursal,
    handleUpdatePersonal,
  };
}

export default useDepositCatalogs;
