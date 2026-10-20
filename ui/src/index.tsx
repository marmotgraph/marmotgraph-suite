import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ConfigProvider } from "./contexts/ConfigContext";
import { AuthProvider } from "./contexts/AuthContext";

// The configuration is loaded first, then the user gets authenticated - only then the app is rendered.
// The router is mounted last so it picks up the URL cleaned up by keycloak after the login redirect.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
