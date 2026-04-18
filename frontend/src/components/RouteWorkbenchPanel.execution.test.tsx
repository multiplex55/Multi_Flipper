import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { RouteWorkbenchPanel } from "@/components/RouteWorkbenchPanel";
import {
  markLineBought,
  markLineSkipped,
  markLineSold,
  resetLineState,
} from "@/lib/savedRouteExecution";
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
    lastVerifiedAt: null,
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
        boughtQty: 0,
        boughtTotal: 0,
        soldQty: 0,
        soldTotal: 0,
        remainingQty: 10,
        status: "planned",
        skipReason: null,
        notes: "",
      },
    },
    manifestSnapshot: null,
    verificationSnapshot: null,
    notes: "",
    tags: [],
    status: "active",
  };
}

function Harness() {
  const [pack, setPack] = useState(makePack());
  return (
    <RouteWorkbenchPanel
      pack={pack}
      onMarkBought={(lineKey, qty) =>
        setPack((prev) => markLineBought(prev, prev.routeKey, lineKey, qty, qty * 100))
      }
      onMarkSold={(lineKey, qty) =>
        setPack((prev) => markLineSold(prev, prev.routeKey, lineKey, qty, qty * 130))
      }
      onMarkSkipped={(lineKey, reason) =>
        setPack((prev) => markLineSkipped(prev, prev.routeKey, lineKey, reason))
      }
      onResetLine={(lineKey) =>
        setPack((prev) => resetLineState(prev, prev.routeKey, lineKey))
      }
    />
  );
}

describe("RouteWorkbenchPanel execution", () => {
  afterEach(() => {
    cleanup();
  });

  it("button actions update line status and summary text", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("qty-100:1:2"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Bought" }));
    fireEvent.click(screen.getByRole("button", { name: "Sold" }));

    expect(screen.getByText("1 / 1 complete")).toBeInTheDocument();
    expect(screen.getByText(/100% capital deployed/)).toBeInTheDocument();
  });

  it("partial fill updates remaining qty and progress percentages", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("qty-100:1:2"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Bought" }));
    fireEvent.change(screen.getByLabelText("qty-100:1:2"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Sold" }));

    expect(screen.getByText(/5\/10 sold/)).toBeInTheDocument();
    expect(screen.getByText(/remain 5/)).toBeInTheDocument();
    expect(screen.getByText(/50% expected profit captured/)).toBeInTheDocument();
  });
});
