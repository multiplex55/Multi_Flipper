import { describe, expect, it } from "vitest";
import { getRadiusRouteExecutionBadge, getRadiusRouteStatusLabel, getRadiusRouteStatusTone } from "@/lib/radiusRouteStatus";
import type { RouteAssignment } from "@/lib/routeAssignments";
import type { RouteQueueEntry } from "@/lib/routeQueue";

function makeQueueEntry(overrides: Partial<RouteQueueEntry> = {}): RouteQueueEntry {
  return {
    routeKey: "route-1",
    routeLabel: "Route 1",
    status: "queued",
    priority: 1,
    assignedPilot: null,
    verificationProfileId: "standard",
    lastVerifiedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<RouteAssignment> = {}): RouteAssignment {
  return {
    routeKey: "route-1",
    assignedCharacterName: "Pilot One",
    status: "queued",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("radiusRouteStatus", () => {
  it("prefers queue status and includes assigned pilot labeling", () => {
    const badge = getRadiusRouteExecutionBadge(
      "route-1",
      [makeQueueEntry({ status: "assigned", assignedPilot: "Aiko" })],
      { "route-1": makeAssignment() },
    );

    expect(badge.status).toBe("assigned");
    expect(badge.label).toBe("assigned · Aiko");
  });

  it("uses warning tone for needs_verify", () => {
    const badge = getRadiusRouteExecutionBadge("route-1", [makeQueueEntry({ status: "needs_verify" })], {});
    expect(badge.tone).toContain("amber");
    expect(getRadiusRouteStatusTone("needs_verify")).toContain("amber");
    expect(getRadiusRouteStatusLabel("needs_verify")).toBe("needs verify");
  });

  it("falls back to assignment status when queue entry is missing", () => {
    const badge = getRadiusRouteExecutionBadge("route-1", [], { "route-1": makeAssignment({ status: "hauling" }) });
    expect(badge.status).toBe("hauling");
  });
});
