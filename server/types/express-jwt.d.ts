// Express request augmentation for JWT authentication
import { User } from "@shared/schema";

export interface JWTPayload {
  userId: string;
  dealershipId: number;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
  jti?: string;
}

// Combined user type that supports both JWT and Replit auth
export type AuthUser = JWTPayload | User | {
  claims?: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    exp?: number;
  };
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
      dealershipContext?: {
        dealershipId: number;
        userId: string;
        userRole: string;
      };
      isAuthenticated?: () => boolean;
      login?: (user: any, callback: (err?: any) => void) => void;
    }
  }
}

export {};
