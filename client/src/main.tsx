import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

/** Boots the React client into the single root DOM node. */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
