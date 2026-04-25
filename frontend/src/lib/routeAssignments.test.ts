import { beforeEach, describe, expect, it } from "vitest";
import {
  getAssignmentsByPilot,
  getAssignmentsByStatus,
  getRouteAssignment,
  loadRouteAssignments,
  removeRouteAssignment,
  ROUTE_ASSIGNMENTS_STORAGE_KEY,
  saveRouteAssignments,
  updateRouteAssignment,
  upsertRouteAssignment,
} from "@/lib/routeAssignments";

describe("routeAssignments", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates, updates, deletes with persistence", () => {
    upsertRouteAssignment({
      routeKey: "route-1",
      assignedCharacterName: "Pilot One",
      assignedCharacterId: 1001,
      status: "queued",
    });

    expect(loadRouteAssignments()).toHaveLength(1);
    expect(getRouteAssignment("route-1")?.assignedCharacterName).toBe("Pilot One");

    updateRouteAssignment("route-1", { status: "buying", notes: "started" });
    expect(getRouteAssignment("route-1")?.status).toBe("buying");
    expect(getRouteAssignment("route-1")?.notes).toBe("started");

    removeRouteAssignment("route-1");
    expect(loadRouteAssignments()).toHaveLength(0);
    expect(localStorage.getItem(ROUTE_ASSIGNMENTS_STORAGE_KEY)).toBe("[]");
  });

  it("migrates legacy assignedCharacter payloads and defaults missing ids", () => {
    localStorage.setItem(
      ROUTE_ASSIGNMENTS_STORAGE_KEY,
      JSON.stringify([
        {
          routeKey: "legacy-route",
          assignedCharacter: "Legacy Pilot",
          status: "hauling",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const [entry] = loadRouteAssignments();
    expect(entry?.assignedCharacterName).toBe("Legacy Pilot");
    expect(entry?.assignedCharacterId).toBeUndefined();
    expect(entry?.characterId).toBeUndefined();
  });

  it("normalizes extended optional metadata fields", () => {
    saveRouteAssignments([
      {
        routeKey: "route-meta",
        assignedCharacterName: "Pilot Meta",
        characterId: 999,
        assignedAt: "2026-01-02T00:00:00.000Z",
        priority: 2,
        reserveCharacterIds: [100, 101],
        reserveCharacterNames: ["Reserve A", "Reserve B"],
        expectedProfitIsk: 1200000,
        expectedCapitalIsk: 5000000,
        expectedJumps: 14,
        verificationStatusAtAssignment: "Good",
        buySystemId: 30000142,
        sellSystemId: 30002187,
        status: "queued",
        updatedAt: new Date().toISOString(),
      },
    ]);

    const entry = loadRouteAssignments()[0];
    expect(entry?.characterId).toBe(999);
    expect(entry?.reserveCharacterIds).toEqual([100, 101]);
    expect(entry?.verificationStatusAtAssignment).toBe("Good");
    expect(entry?.buySystemId).toBe(30000142);
  });

  it("preserves assignedCharacterId in save/load roundtrip", () => {
    saveRouteAssignments([
      {
        routeKey: "route-a",
        assignedCharacterName: "Pilot A",
        assignedCharacterId: 77,
        status: "queued",
        updatedAt: new Date().toISOString(),
      },
    ]);

    expect(loadRouteAssignments()[0]?.assignedCharacterId).toBe(77);
  });

  it("supports status transitions", () => {
    upsertRouteAssignment({
      routeKey: "route-2",
      assignedCharacterName: "Pilot Two",
      status: "queued",
    });
    updateRouteAssignment("route-2", { status: "hauling" });
    expect(getRouteAssignment("route-2")?.status).toBe("hauling");

    updateRouteAssignment("route-2", { status: "selling" });
    updateRouteAssignment("route-2", { status: "done" });
    expect(getRouteAssignment("route-2")?.status).toBe("done");
  });

  it("supports route-key lookup and filtering", () => {
    saveRouteAssignments([
      {
        routeKey: "route-a",
        assignedCharacterName: "Pilot A",
        status: "queued",
        updatedAt: new Date().toISOString(),
      },
      {
        routeKey: "route-b",
        assignedCharacterName: "Pilot B",
        status: "buying",
        updatedAt: new Date().toISOString(),
      },
      {
        routeKey: "route-c",
        assignedCharacterName: "Pilot A",
        status: "buying",
        updatedAt: new Date().toISOString(),
      },
    ]);

    expect(getRouteAssignment("route-b")?.assignedCharacterName).toBe("Pilot B");
    expect(getAssignmentsByPilot("pilot a")).toHaveLength(2);
    expect(getAssignmentsByStatus("buying").map((entry) => entry.routeKey).sort()).toEqual([
      "route-b",
      "route-c",
    ]);
  });
});
