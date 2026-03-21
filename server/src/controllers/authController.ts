import type { RequestHandler } from "express";

import { createSession } from "../db/sessionRepo.js";
import { createGuestAccount } from "../services/auth/createGuestAccount.js";
import { login } from "../services/auth/login.js";
import { requestPasswordReset } from "../services/auth/requestPasswordReset.js";
import { resetPassword } from "../services/auth/resetPassword.js";
import { upgradeCurrentAccount } from "../services/auth/upgradeCurrentAccount.js";
import { createAuthTokens } from "../utils/tokenUtils.js";

/** Creates an anonymous player session and returns the auth token payload. */
export const createGuestSessionController: RequestHandler = async (_request, response, next): Promise<void> => {
  try {
    const guestAccount = await createGuestAccount();
    const tokens = createAuthTokens(guestAccount.playerId);

    await createSession({
      accountId: guestAccount.accountId,
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshTokenExpiresAt
    });

    response.json({
      success: true,
      data: {
        accountId: guestAccount.accountId,
        playerId: guestAccount.playerId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/** Upgrades the authenticated guest account into a registered account. */
export const upgradeAccountController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const playerId = request.user?.playerId;

    if (!playerId) {
      next(new Error("Unauthorized"));
      return;
    }

    const { username, password, email } = request.body as {
      username: string;
      password: string;
      email: string;
    };
    const upgradeResult = await upgradeCurrentAccount({
      playerId,
      username,
      password,
      email
    });
    const tokens = createAuthTokens(playerId);

    await createSession({
      accountId: upgradeResult.accountId,
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshTokenExpiresAt
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
    const { username, password } = request.body as {
      username: string;
      password: string;
    };
    const loginResult = await login({
      username,
      password
    });
    const tokens = createAuthTokens(loginResult.playerId);

    await createSession({
      accountId: loginResult.accountId,
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshTokenExpiresAt
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

/** Creates a password reset token and returns the raw token for the delivery layer. */
export const requestPasswordResetController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const { email } = request.body as {
      email: string;
    };

    response.json({
      success: true,
      data: {
        token: await requestPasswordReset(email)
      }
    });
  } catch (error) {
    next(error);
  }
};

/** Consumes a password reset token and updates the account password. */
export const resetPasswordController: RequestHandler = async (request, response, next): Promise<void> => {
  try {
    const { token, newPassword } = request.body as {
      token: string;
      newPassword: string;
    };

    await resetPassword({
      token,
      newPassword
    });

    response.json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
