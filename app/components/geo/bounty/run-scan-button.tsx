"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RunScanButtonProps = {
  onSuccess?: () => void;
  scanInProgress?: boolean;
};

export function RunScanButton({ onSuccess, scanInProgress: externalProgress }: RunScanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingState = externalProgress ?? loading;

  const handleRunScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/geo/bounty", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Failed to run bounty scan");
        return;
      }

      onSuccess?.();
      router.refresh();
    } catch (err) {
      console.error("Bounty scan error", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRunScan}
        disabled={loadingState}
        className="glass-button-primary inline-flex items-center gap-2"
      >
        {loadingState ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Scanning…
          </>
        ) : (
          <>
            <ScanIcon />
            Run Scan
          </>
        )}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ScanIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
      <path d="M12 7v10" />
    </svg>
  );
}
