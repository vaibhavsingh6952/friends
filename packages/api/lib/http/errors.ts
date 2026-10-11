import { corsHeaders } from "./cors.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Rate limited");
    this.name = "RateLimitedError";
  }
}

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export function mapErrorToResponse(error: Error, origin: string | null): Response {
  if (error instanceof ValidationError) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  }
  if (error instanceof NotFoundError) {
    return new Response(JSON.stringify({ error: error.message }), { status: 404, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  }
  if (error instanceof RateLimitedError) {
    return new Response(JSON.stringify({ error: "Rate limited", retryAfter: error.retryAfter }), {
      status: 429,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Retry-After": String(error.retryAfter) },
    });
  }
  if (error instanceof UpstreamError) {
    return new Response(JSON.stringify({ error: error.message }), { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
}