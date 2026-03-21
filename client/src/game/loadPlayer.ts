import { apiGet } from "../api/client";
import type { PlayerState } from "../auth/bootstrapAuth";

/** Loads the authenticated player's current state from the server. */
export async function loadPlayer(): Promise<PlayerState> {
  return apiGet<PlayerState>("/state");
}
