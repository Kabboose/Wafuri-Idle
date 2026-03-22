import type { PlayerState } from "../auth/bootstrapAuth";
import { getPlayerState } from "../generated/openapi-client";

/** Loads the authenticated player's current state from the server. */
export async function loadPlayer(): Promise<PlayerState> {
  return getPlayerState();
}
