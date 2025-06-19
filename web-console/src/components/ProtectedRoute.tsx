import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactElement;
  roles?: Array<'super' | 'agency' | 'dealer'>; // allowed roles
}

/**
 * Wrapper component that checks user role before rendering children.
 * If user is not authenticated or does not have an allowed role,
 * it renders a simple 403 page or redirects to home.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return null; // or a spinner

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user!.role as any)) {
    return (
      <div className="flex h-screen items-center justify-center text-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold">403 – Forbidden</h1>
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;