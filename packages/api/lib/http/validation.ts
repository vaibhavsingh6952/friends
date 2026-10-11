export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.length > 39) return { valid: false, error: "Username must be 1-39 characters" };
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    return { valid: false, error: "Username may only contain alphanumeric characters and single hyphens" };
  }
  return { valid: true };
}

export function parseLimit(param: string | null): number {
  const n = param ? parseInt(param, 10) : 40;
  if (isNaN(n) || n < 1) return 40;
  return Math.min(n, 50);
}