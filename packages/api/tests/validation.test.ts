import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateUsername, parseLimit } from "../lib/http/validation.js";

describe("validation", () => {
  it("validates correct usernames", () => {
    expect(validateUsername("octocat")).toEqual({ valid: true });
    expect(validateUsername("user-name")).toEqual({ valid: true });
    expect(validateUsername("a")).toEqual({ valid: true });
    expect(validateUsername("a".repeat(39))).toEqual({ valid: true });
  });

  it("rejects invalid usernames", () => {
    expect(validateUsername("")).toEqual({ valid: false, error: "Username must be 1-39 characters" });
    expect(validateUsername("a".repeat(40))).toEqual({ valid: false, error: "Username must be 1-39 characters" });
    expect(validateUsername("-user")).toEqual({ valid: false, error: "Username may only contain alphanumeric characters and single hyphens" });
    expect(validateUsername("user-")).toEqual({ valid: false, error: "Username may only contain alphanumeric characters and single hyphens" });
    expect(validateUsername("user--name")).toEqual({ valid: false, error: "Username may only contain alphanumeric characters and single hyphens" });
    expect(validateUsername("user@name")).toEqual({ valid: false, error: "Username may only contain alphanumeric characters and single hyphens" });
  });

  it("parses limit correctly", () => {
    expect(parseLimit("10")).toBe(10);
    expect(parseLimit("100")).toBe(50);
    expect(parseLimit("0")).toBe(40);
    expect(parseLimit("-5")).toBe(40);
    expect(parseLimit(null)).toBe(40);
    expect(parseLimit("abc")).toBe(40);
  });
});