import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

// Alias for backwards compatibility
export const useAuth = useAuthContext;