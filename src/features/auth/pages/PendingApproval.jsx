import React, { useContext } from "react";
import { Clock, LogOut } from "lucide-react";
import { AuthContext } from "../context/AuthContext.jsx";

function PendingApproval() {
  const { logout, currentUser } = useContext(AuthContext);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 inline-block rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/50">
          <Clock className="text-yellow-600 dark:text-yellow-400" size={34} />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Cuenta Pendiente de Aprobacion</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Hola, <span className="font-semibold">{currentUser?.nombre}</span>. Tu cuenta ha sido creada pero
          necesita ser activada por un administrador. Contacta a soporte si la espera es muy larga.
        </p>
        <button
          onClick={logout}
          className="inline-flex items-center justify-center space-x-2 rounded-lg bg-gray-200 px-6 py-2.5 font-semibold text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          <LogOut size={14} />
          <span>Cerrar Sesion</span>
        </button>
      </div>
    </div>
  );
}

export default PendingApproval;
