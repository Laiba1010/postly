"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string; message?: string }>;
};

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    fetch(`${apiUrl}/api/health`)
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  const renderStatus = (label: string, ok: boolean | undefined) => (
    <div>
      {label}: {ok ? "✓ Connected" : "✗ Not connected"}
    </div>
  );

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Postly System Status</h1>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {health && (
        <>
          {renderStatus("API", health.status === "ok")}
          {renderStatus("Database", health.info?.mongodb?.status === "up")}
          {renderStatus("Redis", health.info?.redis?.status === "up")}
        </>
      )}
      {!health && !error && <p>Loading...</p>}
    </div>
  );
}