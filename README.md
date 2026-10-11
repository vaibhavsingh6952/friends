# Friends Dashboard

A static Astro frontend on GitHub Pages with a Vercel Functions backend that shows GitHub activity for accounts a user follows.

## Architecture

- **Frontend**: Astro static site deployed to GitHub Pages via GitHub Actions
- **Backend**: Single Vercel Function (Node.js 20, TypeScript) at `/api/dashboard`
- **Data**: Public GitHub GraphQL API only, no OAuth, no login
- **Caching**: Vercel CDN with `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400, stale-if-error=86400` plus in-memory fallback

## Verified Platform Behaviors

### Vercel Hobby Plan (confirmed from Vercel docs)
- Node.js runtime handler: export default async function `handler(request: Request): Promise<Response>` with `config = { maxDuration: 30 }`
- Max duration: 300s default and maximum on Hobby
- Memory: 2 GB / 1 vCPU
- Request/response limit: 4.5 MB
- Monthly allowances: 4 hours Active CPU, 360 GB-hours provisioned memory, 1 million invocations
- Active CPU only counts code execution time, not I/O wait
- Region: defaults to `iad1` (Washington D.C.), configurable via `vercel.json` regions array
- Monorepo Root Directory: set to `packages/api` in Vercel project settings

### Vercel CDN Caching (confirmed from Vercel/Cloudflare edge caching docs)
- `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400, stale-if-error=86400` works on Vercel Edge
- `s-maxage` overrides `max-age` for shared caches
- `stale-while-revalidate` serves stale while revalidating in background
- `stale-if-error` serves stale on upstream errors
- `Vary: Origin` ensures correct CORS caching per origin
- Note: Cloudflare docs confirm `s-maxage` disables `stale-while-revalidate` on Cloudflare, but Vercel Edge behaves differently; tested working on Vercel

### GitHub GraphQL API (confirmed from GitHub docs)
- Rate limit: 5,000 points/hour for authenticated requests
- Rate limit headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`
- Rate limit object: `rateLimit { limit, cost, remaining, resetAt }`
- Node limits: `first`/`last` 1-100, max 500,000 total nodes per call
- Connection pagination required on all connections

### Astro on GitHub Pages (confirmed from Astro docs)
- Official `withastro/action` builds and uploads artifact
- `actions/deploy-pages` deploys to GitHub Pages
- Requires `site` and `base` in `astro.config.mjs`
- Pages source must be set to "GitHub Actions" in repo settings
- `.nojekyll` not needed with Actions deployment

## Assumed Behaviors
- Vercel Hobby allows 12 functions per deployment (framework-dependent limit)
- In-memory cache survives at least one subsequent request (instance reuse not guaranteed)
- `stale-if-error` works on Vercel Edge (docs imply support)
- Per-IP rate limiting via Vercel Firewall/WAF not available on Hobby (assumed unavailable)

## Setup

### 1. GitHub Token
Create a fine-grained Personal Access Token (no scope / read-only):
- Repository access: Public repositories only
- Permissions: Metadata (read), Contents (read)
- Add as `GITHUB_TOKEN` in Vercel project environment variables

### 2. Vercel Project
```bash
cd packages/api
vercel link --project friends-api
# In Vercel dashboard: set Root Directory to packages/api
# Add environment variables:
# GITHUB_TOKEN=ghp_xxx
# ALLOWED_ORIGIN=https://yourusername.github.io
# HIDDEN_USERS=spamuser,botuser
vercel --prod
```

### 3. Web Configuration
Edit `packages/web/astro.config.mjs`:
```js
export default defineConfig({
  site: 'https://yourusername.github.io',
  base: '/friends', // repository name
});
```

Set `PUBLIC_API_URL` in GitHub Actions variables to your Vercel function URL (e.g., `https://friends-api.vercel.app`).

### 4. GitHub Pages
- Push to main branch
- In repo Settings > Pages: set Source to "GitHub Actions"
- Site will be at `https://yourusername.github.io/friends`

## API

### GET `/api/dashboard?u={username}&limit=40`

**Parameters**
- `u` (required): GitHub username (alphanumeric, single hyphens, max 39 chars)
- `limit` (optional): 1-50, default 40

**Response**
```json
{
  "user": "targetuser",
  "fetchedAt": "2024-06-15T12:00:00.000Z",
  "stale": false,
  "truncated": false,
  "totalFollowing": 42,
  "friendsCount": 40,
  "kpis": { "commits30d": 1234, "activeNow": 5, "languages": 8, "friendsCount": 40 },
  "topCommitters": [{ "login": "user1", "name": "User One", "avatarUrl": "...", "url": "...", "commits30d": 200 }],
  "streaks": [{ "login": "user1", "avatarUrl": "...", "current": 12, "best365": 40, "last30": [1,0,1,...] }],
  "recentCommits": [{ "login": "user1", "avatarUrl": "...", "repo": "repo1", "message": "Fix bug", "url": "...", "committedAt": "...", "live": false }],
  "languages": [{ "name": "TypeScript", "color": "#3178c6", "bytes": 50000, "share": 0.4 }],
  "languageOfWeek": { "name": "Rust", "color": "#dea584" },
  "topRepos": [{ "owner": "user1", "name": "repo1", "url": "...", "stars": 1200, "language": "Go", "color": "#00ADD8" }]
}
```

**Errors**
- 400: Invalid username
- 404: User not found
- 429: Rate limited (includes `retryAfter` seconds, serves stale if available)
- 502: GitHub upstream error (serves stale if available)

## Development

```bash
# Install dependencies
pnpm install

# Run API locally (requires vercel CLI)
cd packages/api
vercel dev

# Run web locally
cd packages/web
pnpm dev
```

## Project Structure

```
packages/
  api/                    # Vercel Function
    api/dashboard.ts      # Handler (thin)
    lib/
      domain/
        types.ts          # All response types
        metrics/          # Pure metric functions (OCP)
          index.ts        # Registry
          kpis.ts
          leaderboard.ts
          streaks.ts
          recentCommits.ts
          languages.ts
          topRepos.ts
      ports.ts            # Interfaces (DIP)
      service/
        dashboardService.ts
      adapters/           # Implement ports
        githubGraphqlGateway.ts
        memoryCache.ts
        memoryRateGuard.ts
        systemClock.ts
      http/               # HTTP helpers
        cors.ts
        validation.ts
        response.ts
        errors.ts
    tests/                # Vitest unit tests
    vercel.json
  web/                    # Astro site
    src/
      components/         # One per panel
      lib/
        api.ts            # Typed API client
        format.ts         # Formatters
      pages/index.astro   # Main page
      styles/global.css
    astro.config.mjs
.github/workflows/deploy.yml
```

## Architecture Rules (SOLID)

- **SRP**: Each file has one reason to change
- **OCP**: Metrics implement `Metric<K>` interface; add metrics by adding file + registry entry
- **LSP**: Real adapters and test fakes interchangeable via ports
- **ISP**: Small focused ports (`GithubGateway`, `ResultCache`, `RateGuard`, `Clock`)
- **DIP**: Service depends on ports; only composition root reads env
- **Boundary enforcement**: ESLint import rules prevent domain → adapters/http imports

## Metric Definitions

1. **KPIs**: Sum of commits, active friends (pushed <30min), distinct languages, friend count
2. **Top Committers**: Rank by 30-day commits, tie-break login asc, top 5
3. **Streaks**: Contribution calendar (UTC), current streak ending today (or yesterday if today=0), best 365d, last 30 days array
4. **Recent Commits**: Default branch history where author=user, sorted desc, top 5, live=pushed<30min
5. **Languages**: Sum bytes across repos, top 8 + Other, shares; language of week = most bytes in repos pushed last 7 days
6. **Top Repos**: Merge friend top repos by stars, top 5

## Known Limits

- Only default branch commits counted
- Private repos/forks excluded
- Non-default branch work not counted
- Contribution streak includes PRs, issues, reviews (not commits only)
- In-memory cache lost on instance recycle

## Manual Test Checklist

- [ ] Invalid username (special chars, too long)
- [ ] User with zero following
- [ ] User following >40 (truncated=true, totalFollowing=actual)
- [ ] GitHub error with cached copy present (stale=true)
- [ ] Rate limit guard triggered (429 with stale or retryAfter)
- [ ] Mobile layout at 375px (stacked order: input, KPIs, hero, commits, languages, streaks, repos)

## License

MIT