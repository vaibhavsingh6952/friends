import type { DashboardResponse, TopCommitter, Streak, RecentCommit, LanguageMix, LanguageOfWeek, TopRepo, KPIs } from "@friends/api/lib/domain/types";

export type { DashboardResponse, TopCommitter, Streak, RecentCommit, LanguageMix, LanguageOfWeek, TopRepo, KPIs };

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";

export async function fetchDashboard(username: string, limit = 40): Promise<DashboardResponse> {
  const url = `${API_BASE}/api/dashboard?u=${encodeURIComponent(username)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function getUsernameFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("u");
}

export function setUsernameInUrl(username: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("u", username);
  window.history.replaceState({}, "", url);
}