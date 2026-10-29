"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let cancelled = false;

    async function register() {
      try {
        const result = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none"
        });
        if (cancelled) return;
        registration = result;
        await result.update();
      } catch {
        // The app itself stays usable if service workers are unavailable.
      }
    }

    function checkForUpdate() {
      if (document.visibilityState === "visible") void registration?.update();
    }

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    document.addEventListener("visibilitychange", checkForUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  return null;
}
