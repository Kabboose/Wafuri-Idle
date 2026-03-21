import type { RequestHandler } from "express";

import { createGuestSession } from "../services/auth/createGuestSession.js";
import { issueRefreshedAccessToken } from "../services/auth/issueRefreshedAccessToken.js";
import { issueAuthSession } from "../services/auth/issueAuthSession.js";
import { login } from "../services/auth/login.js";
import { requestPasswordReset } from "../services/auth/requestPasswordReset.js";
import { resetPassword } from "../services/auth/resetPassword.js";
import { upgradeCurrentAccount } from "../services/auth/upgradeCurrentAccount.js";

/** Creates an anonymous player session and returns the auth token payload. */
export const createGuestSessionController: RequestHandler = async (_request, response, next): Promise<void> => {
  try {
    const now = new Date();
    const guestSession = await createGuestSession(now);

    response.json({
      success: true,
      data: guestSession
    });
  } catch (error) {
    next(error);
  }
};

/** Upgrades the authenticated guest account into a registered account. */
export const upgradeAccountController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = new Date();
    const accountId = request.user?.accountId;
    const playerId = request.user?.playerId;

    if (!accountId || !playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const { username, password, email } = request.body as {
      username: string;
      password: string;
      email: string;
    };
    const upgradeResult = await upgradeCurrentAccount({
      accountId,
      username,
      password,
      email
    });
    const tokens = await issueAuthSession({
      accountId: upgradeResult.accountId,
      playerId,
      now
    });

    response.json({
      success: true,
      data: {
        ...upgradeResult,
        playerId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/** Authenticates a registered account and returns a signed auth token plus linked ids. */
export const loginController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = new Date();
    const { username, password } = request.body as {
      username: string;
      password: string;
    };
    const loginResult = await login({
      username,
      password
    });
    const tokens = await issueAuthSession({
      accountId: loginResult.accountId,
      playerId: loginResult.playerId,
      now
    });

    response.json({
      success: true,
      data: {
        ...loginResult,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/** Exchanges a valid refresh token for a new short-lived access token. */
export const refreshSessionController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const nowMs = Date.now();
    const { refreshToken } = request.body as {
      refreshToken: string;
    };
    const result = await issueRefreshedAccessToken({
      refreshToken,
      nowMs
    });

    response.json({
      success: true,
      data: {
        accessToken: result.accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/** Creates a password reset token and returns the raw token for the delivery layer. */
export const requestPasswordResetController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = new Date();
    const { email } = request.body as {
      email: string;
    };

    response.json({
      success: true,
      data: {
        token: await requestPasswordReset(email, now)
      }
    });
  } catch (error) {
    next(error);
  }
};

/** Consumes a password reset token and updates the account password. */
export const resetPasswordController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const now = new Date();
    const { token, newPassword } = request.body as {
      token: string;
      newPassword: string;
    };

    await resetPassword({
      token,
      newPassword,
      now
    });

    response.json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
