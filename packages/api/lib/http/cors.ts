export function getAllowedOrigin(): string {
  return process.env.ALLOWED_ORIGIN ?? "http://localhost:4321";
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigin();
  return origin === allowed || origin === "http://localhost:4321";
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin) ? origin : getAllowedOrigin();
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export function handleOptions(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}