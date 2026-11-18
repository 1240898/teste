import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/** AA03: current session (roles confirmed by GET /auth/me) and auth actions. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}