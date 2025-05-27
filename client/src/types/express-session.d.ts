import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      name: string;
      email: string;
      role: string;
      dealership_id: number | null;
    };
  }
}