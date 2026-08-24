import { AuthProvider } from "../features/auth/context/AuthContext.jsx";
import { ThemeProvider } from "../contexts/ThemeContext.jsx";
import { ToastProvider } from "../components/ToastProvider.jsx";

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default AppProviders;
