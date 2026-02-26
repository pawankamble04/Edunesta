import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BG_SYNC_TAG = "edunesta-bg-sync-v1";

const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  )
);

const requestQueuedSync = async () => {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    if ("sync" in registration) {
      await registration.sync.register(BG_SYNC_TAG);
      return;
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "EDUNESTA_SYNC_NOW" });
    }
  } catch {
    // Ignore sync registration errors.
  }
};

const clearServiceWorkerCaches = async () => {
  if (!("caches" in window)) return;
  try {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  } catch {
    // Ignore cache cleanup errors.
  }
};

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      if ("sync" in registration) {
        await registration.sync.register(BG_SYNC_TAG);
      }
    } catch {
      // Ignore service worker registration errors.
    }
  });

  window.addEventListener("online", () => {
    void requestQueuedSync();
  });
}

if ("serviceWorker" in navigator && import.meta.env.DEV) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      // Ignore dev unregister errors.
    }
    await clearServiceWorkerCaches();
  });
}

