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
      assignedCharacter: "Pilot One",
      status: "queued",
    });

    expect(loadRouteAssignments()).toHaveLength(1);
    expect(getRouteAssignment("route-1")?.assignedCharacter).toBe("Pilot One");

    updateRouteAssignment("route-1", { status: "buying", notes: "started" });
    expect(getRouteAssignment("route-1")?.status).toBe("buying");
    expect(getRouteAssignment("route-1")?.notes).toBe("started");

    removeRouteAssignment("route-1");
    expect(loadRouteAssignments()).toHaveLength(0);
    expect(localStorage.getItem(ROUTE_ASSIGNMENTS_STORAGE_KEY)).toBe("[]");
  });

  it("supports status transitions", () => {
    upsertRouteAssignment({
      routeKey: "route-2",
      assignedCharacter: "Pilot Two",
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
        assignedCharacter: "Pilot A",
        status: "queued",
        updatedAt: new Date().toISOString(),
      },
      {
        routeKey: "route-b",
        assignedCharacter: "Pilot B",
        status: "buying",
        updatedAt: new Date().toISOString(),
      },
      {
        routeKey: "route-c",
        assignedCharacter: "Pilot A",
        status: "buying",
        updatedAt: new Date().toISOString(),
      },
    ]);

    expect(getRouteAssignment("route-b")?.assignedCharacter).toBe("Pilot B");
    expect(getAssignmentsByPilot("pilot a")).toHaveLength(2);
    expect(getAssignmentsByStatus("buying").map((entry) => entry.routeKey).sort()).toEqual([
      "route-b",
      "route-c",
    ]);
  });
});
