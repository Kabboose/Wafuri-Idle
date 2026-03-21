import type { NextFunction, Request, Response } from "express";

import { getSession } from "../services/cacheService.js";

type AuthenticatedRequest = Request & {
  playerId?: string;
};

export async function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  try {
    const authorizationHeader = request.header("Authorization");

    if (!authorizationHeader?.startsWith("Bearer ")) {
      response.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const token = authorizationHeader.slice("Bearer ".length);
    const session = await getSession(token);

    if (!session) {
      response.status(401).json({ error: "Invalid session token" });
      return;
    }

    request.playerId = session.playerId;
    next();
  } catch (error) {
    next(error);
  }
}

export type { AuthenticatedRequest };
