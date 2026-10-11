import { GithubGraphqlGateway } from "../adapters/githubGraphqlGateway.js";
import { MemoryCache } from "../adapters/memoryCache.js";
import { MemoryRateGuard } from "../adapters/memoryRateGuard.js";
import { SystemClock } from "../adapters/systemClock.js";
import { DashboardService, NotFoundError, RateLimitedError, UpstreamError } from "../service/dashboardService.js";
import { validateUsername, parseLimit } from "../http/validation.js";
import { dashboardResponse, mapErrorToResponse } from "../http/response.js";
import { handleOptions } from "../http/cors.js";
import type { DashboardResponse } from "../domain/types.js";

const githubToken = process.env.GITHUB_TOKEN;
const hiddenUsers = new Set((process.env.HIDDEN_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean));

if (!githubToken) {
  console.warn("GITHUB_TOKEN not set; API will fail");
}

const github = new GithubGraphqlGateway(githubToken ?? "");
const cache = new MemoryCache();
const rateGuard = new MemoryRateGuard();
const clock = new SystemClock();
const service = new DashboardService(github, cache, rateGuard, clock, hiddenUsers);

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return handleOptions(origin);
  }

  if (request.method !== "GET") {
    return mapErrorToResponse(new Error("Method not allowed"), origin);
  }

  const url = new URL(request.url);
  const username = url.searchParams.get("u");
  const limit = parseLimit(url.searchParams.get("limit"));

  const validation = validateUsername(username ?? "");
  if (!validation.valid) {
    return mapErrorToResponse(new Error(validation.error), origin);
  }

  try {
    const data = await service.getDashboard(username!, limit);
    return dashboardResponse(data, origin);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof RateLimitedError || e instanceof UpstreamError) {
      return mapErrorToResponse(e, origin);
    }
    return mapErrorToResponse(e as Error, origin);
  }
}

export const config = {
  maxDuration: 30,
};