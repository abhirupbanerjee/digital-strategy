'use client';

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optional: fire-and-forget logging without blocking UI (no PII)
    // void fetch('/api/log-error', {
    //   method: 'POST',
    //   headers: { 'content-type': 'application/json' },
    //   body: JSON.stringify({ message: error?.message, digest: error?.digest }),
    // }).catch(() => {});
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto mt-24 max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm"
    >
      <h1 className="text-lg font-semibold text-red-700">Something went wrong</h1>
      <p className="mt-2 text-sm text-red-800">
        An unexpected error occurred. Please try again. If the problem persists, contact support.
      </p>

      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 overflow-auto rounded-md bg-white p-3 text-xs text-gray-800 ring-1 ring-gray-200">
          {error?.message}
          {error?.digest ? `\nDigest: ${error.digest}` : ""}
        </pre>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
