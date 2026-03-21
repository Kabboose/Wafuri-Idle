import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

import { config } from "../config/index.js";
import type { AuthTokenPayload } from "../utils/playerTypes.js";

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const authorizationHeader = request.header("Authorization");

    if (!authorizationHeader?.startsWith("Bearer ")) {
      response.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const token = authorizationHeader.slice("Bearer ".length);
    const payload = jwt.verify(token, config.jwtSecret) as AuthTokenPayload;

    if (!payload.playerId) {
      response.status(401).json({ error: "Invalid token payload" });
      return;
    }

    request.user = {
      playerId: payload.playerId
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      response.status(401).json({ error: "Invalid bearer token" });
      return;
    }

    next(error);
  }
}
