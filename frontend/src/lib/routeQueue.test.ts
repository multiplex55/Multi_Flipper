import { beforeEach, describe, expect, it } from "vitest";
import {
  getNextQueuedRoute,
  loadRouteQueue,
  normalizeRouteQueueEntry,
  saveRouteQueue,
  upsertRouteQueueEntry,
  type RouteQueueEntry,
} from "@/lib/routeQueue";

function makeEntry(overrides: Partial<RouteQueueEntry> = {}): RouteQueueEntry {
  return {
    routeKey: "loc:1->loc:2",
    routeLabel: "Jita → Amarr",
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

describe("routeQueue", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("upsert replaces duplicate route key", () => {
    const entries = [makeEntry({ routeLabel: "Old", priority: 1 })];
    const next = upsertRouteQueueEntry(entries, makeEntry({ routeLabel: "New", priority: 99 }));
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ routeLabel: "New", priority: 99 });
  });

  it("priority ordering is deterministic", () => {
    const entries = [
      makeEntry({ routeKey: "loc:2->loc:3", priority: 5, updatedAt: "2026-01-01T00:00:01.000Z" }),
      makeEntry({ routeKey: "loc:1->loc:2", priority: 5, updatedAt: "2026-01-01T00:00:01.000Z" }),
      makeEntry({ routeKey: "loc:4->loc:5", priority: 9, updatedAt: "2026-01-01T00:00:01.000Z" }),
    ];
    saveRouteQueue(entries);
    const loaded = loadRouteQueue();
    expect(loaded.map((entry) => entry.routeKey)).toEqual([
      "loc:4->loc:5",
      "loc:1->loc:2",
      "loc:2->loc:3",
    ]);
  });

  it("skipped entries are excluded from next route", () => {
    const next = getNextQueuedRoute([
      makeEntry({ routeKey: "loc:skip->loc:skip", status: "skipped", priority: 100 }),
      makeEntry({ routeKey: "loc:done->loc:done", status: "done", priority: 90 }),
      makeEntry({ routeKey: "loc:ready->loc:ready", status: "queued", priority: 1 }),
    ]);
    expect(next?.routeKey).toBe("loc:ready->loc:ready");
  });

  it("stale verification marks route as needs_verify", () => {
    const normalized = normalizeRouteQueueEntry(
      makeEntry({
        status: "assigned",
        verificationProfileId: "strict",
        lastVerifiedAt: "2026-01-01T00:00:00.000Z",
      }),
      new Date("2026-01-02T12:00:00.000Z"),
    );
    expect(normalized?.status).toBe("needs_verify");
  });

  it("ignores malformed localStorage entries safely", () => {
    window.localStorage.setItem(
      "eve-flipper:route-queue:v1",
      JSON.stringify([
        { routeKey: "", priority: 1 },
        { notRoute: true },
        makeEntry({ routeKey: "loc:ok->loc:good" }),
      ]),
    );
    const loaded = loadRouteQueue();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].routeKey).toBe("loc:ok->loc:good");
  });
});
