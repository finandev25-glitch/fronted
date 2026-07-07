import React, { useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import PasswordStrengthMeter from "../../../components/PasswordStrengthMeter.jsx";
import { AuthContext } from "../context/AuthContext.jsx";

const InputField = ({ name, type, label, icon: Icon, value, onChange, placeholder }) => (
  <div>
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <div className="relative mt-1">
      <Icon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        required
      />
    </div>
  </div>
);

const PasswordField = ({ name, value, onChange, showPassword, onToggleShowPassword }) => (
  <div>
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contrasena</label>
    <div className="relative mt-1">
      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        name={name}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder="********"
        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-gray-900 transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        required
      />
      <button
        type="button"
        onClick={onToggleShowPassword}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  </div>
);

function AuthPage() {
  const [viewMode, setViewMode] = useState("login");
  const { login, register } = useContext(AuthContext);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ fullName: "", email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");

  const handleLoginChange = (event) =>
    setLoginData({ ...loginData, [event.target.name]: event.target.value });
  const handleRegisterChange = (event) =>
    setRegisterData({ ...registerData, [event.target.name]: event.target.value });

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    clearMessages();
    setIsLoading(true);
    const { error: loginError } = await login(loginData.email, loginData.password);
    if (loginError) {
      setError(loginError.message);
    }
    setIsLoading(false);
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    clearMessages();
    if (!registerData.fullName || !registerData.email || !registerData.password) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    setIsLoading(true);
    const { error: registerError } = await register(
      registerData.fullName,
      registerData.email,
      registerData.password
    );
    if (registerError) {
      setError(registerError.message);
    } else {
      setMessage(
        "Registro exitoso. Revisa tu correo para confirmar tu cuenta y espera la activacion del administrador."
      );
      setViewMode("login");
      setRegisterData({ fullName: "", email: "", password: "" });
    }
    setIsLoading(false);
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    clearMessages();
    if (!forgotEmail) {
      setError("Por favor, ingresa tu correo electronico.");
      return;
    }
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setMessage(`Si existe una cuenta asociada a ${forgotEmail}, se envio un enlace de recuperacion.`);
    setIsLoading(false);
    setViewMode("login");
  };

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  const renderContent = () => {
    switch (viewMode) {
      case "register":
        return (
          <motion.form
            key="register"
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onSubmit={handleRegisterSubmit}
            className="space-y-5"
          >
            <h2 className="mb-2 text-center text-xl font-semibold dark:text-gray-100">Crear una cuenta</h2>
            <InputField
              name="fullName"
              type="text"
              label="Nombre Completo"
              icon={User}
              value={registerData.fullName}
              onChange={handleRegisterChange}
              placeholder="Ej: Ana Garcia"
            />
            <InputField
              name="email"
              type="email"
              label="Correo Electronico"
              icon={Mail}
              value={registerData.email}
              onChange={handleRegisterChange}
              placeholder="tu@correo.com"
            />
            <PasswordField
              name="password"
              value={registerData.password}
              onChange={handleRegisterChange}
              showPassword={showPassword}
              onToggleShowPassword={() => setShowPassword(!showPassword)}
            />
            <PasswordStrengthMeter password={registerData.password} />
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <UserPlus size={14} />}
              <span>{isLoading ? "Registrando..." : "Registrarse"}</span>
            </button>
          </motion.form>
        );
      case "forgot":
        return (
          <motion.form
            key="forgot"
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onSubmit={handleForgotSubmit}
            className="space-y-5"
          >
            <h2 className="mb-2 text-center text-xl font-semibold dark:text-gray-100">Recuperar Contrasena</h2>
            <p className="-mt-2 mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
              Ingresa tu correo para recibir un enlace de recuperacion.
            </p>
            <InputField
              name="email"
              type="email"
              label="Correo Electronico"
              icon={Mail}
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              placeholder="tu@correo.com"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isLoading && <Loader2 className="animate-spin" />}
              <span>{isLoading ? "Enviando..." : "Enviar Enlace"}</span>
            </button>
          </motion.form>
        );
      default:
        return (
          <motion.form
            key="login"
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onSubmit={handleLoginSubmit}
            className="space-y-5"
          >
            <h2 className="mb-2 text-center text-xl font-semibold dark:text-gray-100">Iniciar Sesion</h2>
            <InputField
              name="email"
              type="tel"
              label="Numero de Telefono"
              icon={Phone}
              value={loginData.email}
              onChange={handleLoginChange}
              placeholder="999999999"
            />
            <PasswordField
              name="password"
              value={loginData.password}
              onChange={handleLoginChange}
              showPassword={showPassword}
              onToggleShowPassword={() => setShowPassword(!showPassword)}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600" />
              <button
                type="button"
                onClick={() => {
                  setViewMode("forgot");
                  clearMessages();
                }}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                Olvidaste tu contrasena?
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isLoading && <Loader2 className="animate-spin" />}
              <span>{isLoading ? "Ingresando..." : "Ingresar"}</span>
            </button>
          </motion.form>
        );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-block rounded-2xl bg-blue-600 p-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck className="text-white" size={22} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Control de Depositos</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Bienvenido. Ingresa tus credenciales.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>

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
            {message && (
              <motion.p
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-4 rounded-lg bg-green-50 p-3 text-center text-sm text-green-600 dark:bg-green-900/30 dark:text-green-300"
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-6 text-center">
            {viewMode === "login" && (
              <button
                onClick={() => {
                  setViewMode("register");
                  clearMessages();
                }}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                No tienes una cuenta? Registrate aqui
              </button>
            )}
            {viewMode === "register" && (
              <button
                onClick={() => {
                  setViewMode("login");
                  clearMessages();
                }}
                className="flex w-full items-center justify-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                <ArrowLeft size={12} className="mr-1" /> Ya tienes una cuenta? Inicia sesion
              </button>
            )}
            {viewMode === "forgot" && (
              <button
                onClick={() => {
                  setViewMode("login");
                  clearMessages();
                }}
                className="flex w-full items-center justify-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                <ArrowLeft size={12} className="mr-1" /> Volver a Iniciar Sesion
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
