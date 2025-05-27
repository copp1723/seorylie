import { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
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
    }

    interface Request {
      user?: User;
    }
  }
}