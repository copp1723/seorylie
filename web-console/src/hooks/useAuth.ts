// Simple hook to use the auth context
import { useAuthContext } from '../contexts/AuthContext';

export const useAuth = () => {
  return useAuthContext();
};

export default useAuth;