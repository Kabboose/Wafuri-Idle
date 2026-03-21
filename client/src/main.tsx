import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { bootstrapAuth } from "./auth/bootstrapAuth";

const root = ReactDOM.createRoot(document.getElementById("root")!);

/** Renders a minimal startup loading state while auth bootstrap completes. */
function renderLoading(): void {
  root.render(
    <React.StrictMode>
      <main>Loading...</main>
    </React.StrictMode>
  );
}

/** Renders a minimal startup error state if auth bootstrap fails. */
function renderError(message: string): void {
  root.render(
    <React.StrictMode>
      <main>{message}</main>
    </React.StrictMode>
  );
}

/** Boots the React client only after authentication bootstrap has completed. */
async function startApp(): Promise<void> {
  renderLoading();

  try {
    const authState = await bootstrapAuth();

    root.render(
      <React.StrictMode>
        <App initialPlayerState={authState.playerState} />
      </React.StrictMode>
    );
  } catch (error) {
    renderError(error instanceof Error ? error.message : "Failed to bootstrap authentication");
  }
}

void startApp();
