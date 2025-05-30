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

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload | User;
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
