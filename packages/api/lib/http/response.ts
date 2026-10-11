import type { DashboardResponse } from "../domain/types.js";
import { corsHeaders } from "./cors.js";

export function jsonResponse(data: unknown, init: ResponseInit = {}, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...init.headers,
    },
  });
}

export function errorResponse(
  message: string,
  status: number,
  origin: string | null = null,
  extra: Record<string, unknown> = {}
): Response {
  return jsonResponse({ error: message, ...extra }, { status }, origin);
}

export function dashboardResponse(data: DashboardResponse, origin: string | null = null): Response {
  const headers = {
    ...corsHeaders(origin),
    "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400, stale-if-error=86400",
  };
  return new Response(JSON.stringify(data), { status: 200, headers });
}