import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteWorkbenchPanel } from "@/components/RouteWorkbenchPanel";
import type { SavedRoutePack } from "@/lib/types";

function makePack(): SavedRoutePack {
  return {
    routeKey: "loc:1->loc:2",
    routeLabel: "Jita → Amarr",
    buyLocationId: 1,
    sellLocationId: 2,
    buySystemId: 1,
    sellSystemId: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastVerifiedAt: "2026-01-01T02:00:00.000Z",
    verificationProfileId: "standard",
    entryMode: "core",
    launchIntent: null,
    selectedLineKeys: ["100:1:2"],
    excludedLineKeys: [],
    summarySnapshot: {
      routeItemCount: 1,
      routeTotalProfit: 300,
      routeTotalCapital: 1000,
      routeRealIskPerJump: 0,
      routeDailyIskPerJump: 0,
      routeDailyProfit: 0,
      routeWeightedSlippagePct: 0,
      routeTurnoverDays: null,
      routeSafetyRank: null,
    },
    lines: {
      "100:1:2": {
        lineKey: "100:1:2",
        typeId: 100,
        typeName: "Item A",
        plannedQty: 10,
        plannedBuyPrice: 100,
        plannedSellPrice: 130,
        plannedProfit: 300,
        plannedVolume: 10,
        boughtQty: 10,
        boughtTotal: 1000,
        soldQty: 5,
        soldTotal: 650,
        remainingQty: 5,
        status: "partially_sold",
        skipReason: null,
        notes: "",
      },
    },
    manifestSnapshot: null,
    verificationSnapshot: { status: "Good", currentProfitIsk: 250, minAcceptableProfitIsk: 200, verifiedAt: "2026-01-01T02:00:00.000Z", checkedAt: "2026-01-01T02:00:00.000Z", offenderCount: 0, buyDriftPct: 1, sellDriftPct: 1, profitRetentionPct: 83, offenderLines: [], summary: "ok" },
    notes: "",
    tags: [],
    status: "active",
  };
}

function renderPanel(mode: "summary" | "execution" | "filler" | "verification" = "summary") {
  const callbacks = {
    onVerificationProfileChange: vi.fn(),
    onVerifyNow: vi.fn(),
    onMarkBought: vi.fn(),
    onMarkSold: vi.fn(),
    onMarkSkipped: vi.fn(),
    onResetLine: vi.fn(),
    onCopySummary: vi.fn(),
    onCopyManifest: vi.fn(),
    onTogglePin: vi.fn(),
    onOpenBatchBuilder: vi.fn(),
    onScrollToTable: vi.fn(),
  };
  render(
    <RouteWorkbenchPanel
      pack={makePack()}
      mode={mode}
      isPinned
      verificationProfileId="standard"
      {...callbacks}
    />,
  );
  return callbacks;
}

describe("RouteWorkbenchPanel", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders mode-specific sections", () => {
    renderPanel("filler");
    expect(screen.getByTestId("route-workbench-section-filler")).toBeInTheDocument();
    expect(screen.queryByTestId("route-workbench-section-verification")).not.toBeInTheDocument();
  });

  it("fires action callbacks", () => {
    const callbacks = renderPanel("execution");
    fireEvent.click(screen.getByTestId("route-workbench-action-copy-summary"));
    fireEvent.click(screen.getByTestId("route-workbench-action-copy-manifest"));
    fireEvent.click(screen.getByTestId("route-workbench-action-pin"));
    fireEvent.click(screen.getByTestId("route-workbench-action-open-batch"));
    fireEvent.click(screen.getByTestId("route-workbench-action-scroll"));

    expect(callbacks.onCopySummary).toHaveBeenCalledTimes(1);
    expect(callbacks.onCopyManifest).toHaveBeenCalledTimes(1);
    expect(callbacks.onTogglePin).toHaveBeenCalledTimes(1);
    expect(callbacks.onOpenBatchBuilder).toHaveBeenCalledTimes(1);
    expect(callbacks.onScrollToTable).toHaveBeenCalledTimes(1);
  });

  it("renders freshness and execution summary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T03:00:00.000Z"));
    renderPanel("execution");
    expect(screen.getByTestId("route-workbench-freshness")).toHaveTextContent("fresh");
    expect(screen.getByText(/50% expected profit captured/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
