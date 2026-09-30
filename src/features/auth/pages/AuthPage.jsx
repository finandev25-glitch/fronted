import React, { useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { AuthContext } from "../context/AuthContext.jsx";

// Recuerda el último DNI usado en ESTE navegador (no la contraseña) para que
// el usuario no tenga que reescribirlo cada vez -- conveniencia pura, no es
// dato sensible. Clave separada de SESSION_KEY/CURRENT_USER_KEY
// (AuthContext.jsx) porque esto sobrevive al logout a propósito.
const LAST_DNI_KEY = "control-depositos-last-dni";

function AuthPage() {
  const { login } = useContext(AuthContext);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // El campo se llama "email" por compatibilidad con AuthContext.login
  // (phoneNumber, password), aunque en la práctica acá se ingresa el DNI --
  // ver comentario del label más abajo.
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const dniInputRef = useRef(null);

  // Precarga el último DNI usado y pone el foco donde corresponde: en DNI si
  // está vacío, o directo en Contraseña si ya viene precargado (así no hay
  // que hacer doble clic para escribir la contraseña de una).
  useEffect(() => {
    let lastDni = "";
    try {
      lastDni = localStorage.getItem(LAST_DNI_KEY) || "";
    } catch {
      lastDni = "";
    }
    if (lastDni) {
      setLoginData((prev) => ({ ...prev, email: lastDni }));
    }
    dniInputRef.current?.focus();
  }, []);

  const handleLoginChange = (event) =>
    setLoginData({ ...loginData, [event.target.name]: event.target.value });

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    const { error: loginError } = await login(loginData.email, loginData.password);
    if (loginError) {
      setError(loginError.message);
    } else {
      try {
        localStorage.setItem(LAST_DNI_KEY, loginData.email);
      } catch {
        // localStorage no disponible (modo privado, etc.) -- no es crítico.
      }
    }
    setIsLoading(false);
  };

  const canSubmit = loginData.email.trim() !== "" && loginData.password.trim() !== "";

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-block rounded-2xl bg-blue-600 p-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck className="text-white" size={22} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Control de Depósitos</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Bienvenido. Ingresa tus credenciales.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
          <motion.form
            variants={formVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleLoginSubmit}
            className="space-y-5"
          >
            <h2 className="mb-2 text-center text-xl font-semibold dark:text-gray-100">Iniciar Sesión</h2>

            {/* Esta pantalla la usa solo el personal de Finanzas/Admin, y sus
                cuentas se crean con su DNI (no con un número de teléfono real
                -- ver createUserProfile en AuthContext.jsx). El campo técnico
                que manda el backend sigue llamándose "phoneNumber", pero acá
                se etiqueta como DNI para que coincida con lo que el usuario
                realmente tiene que escribir. */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">DNI</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={dniInputRef}
                  name="email"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  value={loginData.email}
                  onChange={handleLoginChange}
                  placeholder="12345678"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  placeholder="********"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-gray-900 transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="mt-2 flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="animate-spin" />}
              <span>{isLoading ? "Ingresando..." : "Ingresar"}</span>
            </button>
          </motion.form>

          {/* Antes había acá "¿Olvidaste tu contraseña?" y "¿No tienes una
              cuenta? Regístrate aquí" -- se quitaron: ninguno de los dos
              llamaba a un endpoint real (registro pegaba a /auth/register,
              que no existe en api-bridge; "olvidaste tu contraseña" ni
              siquiera llegaba al backend). Solo confundían al usuario. Las
              cuentas de Finanzas/Admin las crea otro admin desde el panel de
              usuarios, y el cambio de contraseña lo hace un admin desde ahí
              también (resetUserPassword en AuthContext.jsx). En su lugar,
              como ya no queda ningún camino de autoservicio si alguien se
              traba, se deja un aviso simple para que sepa a quién recurrir. */}
          <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
            ¿Problemas para ingresar? Contacta al administrador del sistema.
          </p>

          <AnimatePresence>
            {error && (
              <motion.p
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
