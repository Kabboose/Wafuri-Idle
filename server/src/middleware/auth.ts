import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

import { config } from "../config/index.js";
import type { AuthTokenPayload } from "../utils/playerTypes.js";

/** Validates the bearer token and attaches the authenticated account and player ids to the request context. */
export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const authorizationHeader = request.header("Authorization");

    if (!authorizationHeader?.startsWith("Bearer ")) {
      response.status(401).json({ success: false, error: "Missing bearer token" });
      return;
    }

    const token = authorizationHeader.slice("Bearer ".length);
    const payload = jwt.verify(token, config.jwtSecret) as AuthTokenPayload;

    if (!payload.accountId || !payload.playerId) {
      response.status(401).json({ success: false, error: "Invalid token payload" });
      return;
    }

    request.user = {
      accountId: payload.accountId,
      playerId: payload.playerId
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      response.status(401).json({ success: false, error: "Invalid bearer token" });
      return;
    }

    next(error);
  }
}
