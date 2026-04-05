import type { RouteState } from "@/lib/types";

export type CanonicalRouteSafety = "green" | "yellow" | "red" | "unknown";

/**
 * Canonical route-safety ordering policy used by all comparators:
 *   green (safest) < yellow < red < unknown/loading (least trustworthy)
 *
 * Unknown/loading is deliberately ranked worst so incomplete safety data cannot
 * outrank a confirmed safe route.
 */
export const ROUTE_SAFETY_RANK: Record<CanonicalRouteSafety, number> = {
  green: 0,
  yellow: 1,
  red: 2,
  unknown: 3,
};

const ROUTE_SAFETY_ALIASES: Record<string, CanonicalRouteSafety> = {
  green: "green",
  safe: "green",
  safest: "green",
  low: "green",
  ok: "green",

  yellow: "yellow",
  amber: "yellow",
  caution: "yellow",
  moderate: "yellow",
  medium: "yellow",

  red: "red",
  danger: "red",
  dangerous: "red",
  high: "red",
  unsafe: "red",

  unknown: "unknown",
  loading: "unknown",
  pending: "unknown",
  n_a: "unknown",
  na: "unknown",
  "": "unknown",
};

function normalizeSafetyToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, "_");
}

export function normalizeRouteSafety(value: unknown): CanonicalRouteSafety {
  const token = normalizeSafetyToken(value);
  return ROUTE_SAFETY_ALIASES[token] ?? "unknown";
}

export function routeSafetyRank(value: unknown): number {
  return ROUTE_SAFETY_RANK[normalizeRouteSafety(value)];
}

export function routeSafetyRankFromState(
  state: RouteState | null | undefined,
): number {
  if (!state || state.status === "loading") {
    return ROUTE_SAFETY_RANK.unknown;
  }
  return routeSafetyRank(state.danger);
}
