import { AuthProvider } from "../features/auth/context/AuthContext.jsx";
import { ThemeProvider } from "../contexts/ThemeContext.jsx";

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}

export default AppProviders;
