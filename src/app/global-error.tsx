"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#171717",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>
            CareerPilot could not load
          </h1>
          <p style={{ color: "#525252", fontSize: 14, marginTop: 8 }}>
            A critical error occurred before the interface could render. Your
            locally stored data has not been changed.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #d4d4d4",
              background: "#171717",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}
