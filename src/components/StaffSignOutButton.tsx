"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StaffSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/staff/logout", { method: "POST" });
    } catch {
      // ignore — clearing the cookie is best-effort
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
