import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SavedRoutePacksPanel } from "@/components/SavedRoutePacksPanel";
import type { SavedRoutePack } from "@/lib/types";

function makePack(): SavedRoutePack {
  return {
    routeKey: "route-1",
    routeLabel: "Jita → Amarr",
    buyLocationId: 1,
    sellLocationId: 2,
    buySystemId: 10,
    sellSystemId: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastVerifiedAt: null,
    verificationProfileId: "standard",
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: [],
    excludedLineKeys: [],
    summarySnapshot: {
      routeItemCount: 1,
      routeTotalProfit: 100,
      routeTotalCapital: 200,
      routeRealIskPerJump: 10,
      routeDailyIskPerJump: 12,
      routeDailyProfit: 13,
      routeWeightedSlippagePct: 0,
      routeTurnoverDays: null,
      routeSafetyRank: null,
    },
    lines: {},
    manifestSnapshot: null,
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
  };
}

describe("SavedRoutePacksPanel assignments", () => {
  it("renders assignment badge summary text", () => {
    const pack = makePack();
    render(
      <SavedRoutePacksPanel
        packs={[pack]}
        assignmentByRouteKey={{
          [pack.routeKey]: {
            routeKey: pack.routeKey,
            assignedCharacter: "Pilot One",
            status: "buying",
            updatedAt: new Date().toISOString(),
          },
        }}
        onOpen={vi.fn()}
        onVerify={vi.fn()}
        onVerificationProfileChange={vi.fn()}
        onCopy={vi.fn()}
        onRemove={vi.fn()}
        onMarkBought={vi.fn()}
        onMarkSold={vi.fn()}
        onMarkSkipped={vi.fn()}
        onResetLine={vi.fn()}
      />,
    );

    expect(screen.getByText(/active · Pilot One \(buying\)/i)).toBeInTheDocument();
  });
});
