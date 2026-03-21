import type { AuthenticatedUser } from "./playerTypes.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
