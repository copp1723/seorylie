// Express request augmentation for JWT authentication
import { Request } from 'express';
import { JWTPayload } from '../middleware/jwt-auth';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
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
