import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PinnedOpportunitiesTab } from "@/components/PinnedOpportunitiesTab";
import {
  listPinnedOpportunities,
  listPinnedOpportunitySnapshots,
  openMarketInGame,
  removePinnedOpportunity,
  setWaypointInGame,
  subscribePinnedOpportunityChanges,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listPinnedOpportunities: vi.fn(async () => []),
  listPinnedOpportunitySnapshots: vi.fn(async () => []),
  openMarketInGame: vi.fn(async () => undefined),
  setWaypointInGame: vi.fn(async () => undefined),
  removePinnedOpportunity: vi.fn(async () => ({ status: "deleted" })),
  subscribePinnedOpportunityChanges: vi.fn(() => () => undefined),
}));

vi.mock("@/components/ContractDetailsPopup", () => ({
  ContractDetailsPopup: ({ open }: { open: boolean }) => (open ? <div>Contract details popup</div> : null),
}));

const pinned = [
  {
    user_id: "u",
    opportunity_key: "station:34:60003760",
    tab: "station",
    payload_json: "{}",
    created_at: "2026-04-04T00:00:00Z",
    updated_at: "2026-04-04T00:00:00Z",
    payload: {
      source: "station",
      type_id: 34,
      type_name: "Tritanium",
      source_label: "Station",
      buy_label: "Jita IV",
      sell_label: "Jita IV",
      system_id: 30000142,
      metrics: { profit: 1_000_000, margin: 10, volume: 500, route_risk: 2 },
    },
  },
  {
    user_id: "u",
    opportunity_key: "contract:200",
    tab: "contracts",
    payload_json: "{}",
    created_at: "2026-04-04T00:00:00Z",
    updated_at: "2026-04-04T00:00:00Z",
    payload: {
      source: "contracts",
      contract_id: 200,
      type_id: 0,
      type_name: "Navy Omen",
      source_label: "Contracts",
      buy_label: "Perimeter",
      sell_label: "Jita",
      metrics: { profit: 500_000, margin: 5, volume: 30, route_risk: 1 },
    },
  },
];

const snapshots = [
  { id: 1, user_id: "u", opportunity_key: "station:34:60003760", snapshot_label: "scan:100", snapshot_at: "2026-04-04T11:00:00Z", metrics_json: "{}", metrics: { profit: 900_000, margin: 9, volume: 450, route_risk: 3 } },
];

describe("PinnedOpportunitiesTab", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(listPinnedOpportunities).mockResolvedValue(pinned as never);
    vi.mocked(listPinnedOpportunitySnapshots).mockResolvedValue(snapshots as never);
    window.history.replaceState({}, "", "/");
  });

  it("renders human-readable labels and hides raw key in grid columns", async () => {
    render(<PinnedOpportunitiesTab />);
    expect(await screen.findByText("Tritanium")).toBeInTheDocument();
    expect(screen.queryByText("station:34:60003760")).not.toBeInTheDocument();
  });

  it("opens details on row click and supports contract popup", async () => {
    render(<PinnedOpportunitiesTab />);
    fireEvent.click(await screen.findByText("Navy Omen"));
    expect(await screen.findByText("Contract details popup")).toBeInTheDocument();
  });

  it("action buttons call expected APIs", async () => {
    render(<PinnedOpportunitiesTab />);
    const openMarketButtons = await screen.findAllByLabelText("Open market");
    fireEvent.click(openMarketButtons[0]);
    await waitFor(() => expect(openMarketInGame).toHaveBeenCalled());

    const waypointButtons = screen.getAllByLabelText("Set waypoint");
    fireEvent.click(waypointButtons[0]);
    await waitFor(() => expect(setWaypointInGame).toHaveBeenCalled());

    const unpinButtons = screen.getAllByLabelText("Unpin");
    fireEvent.click(unpinButtons[0]);
    await waitFor(() => expect(removePinnedOpportunity).toHaveBeenCalledWith("station:34:60003760"));
  });

  it("disabled actions expose tooltip title", async () => {
    render(<PinnedOpportunitiesTab />);
    const openMarketButtons = await screen.findAllByLabelText("Open market");
    expect(openMarketButtons[1]).toBeDisabled();
    expect(openMarketButtons[1]).toHaveAttribute("title", "No item type for this row");
  });

  it("filters by source and sorts by profit", async () => {
    render(<PinnedOpportunitiesTab />);
    await screen.findByText("Tritanium");
    fireEvent.change(screen.getByLabelText("Filter by source"), { target: { value: "contracts" } });
    expect(screen.getByText("Navy Omen")).toBeInTheDocument();
    expect(screen.queryByText("Tritanium")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by source"), { target: { value: "all" } });
    fireEvent.click(screen.getByText("Profit"));
    expect(screen.getAllByText(/M|K/).length).toBeGreaterThan(0);
  });

  it("reloads rows when pin-change event subscription fires", async () => {
    const handlers: Array<() => void> = [];
    vi.mocked(subscribePinnedOpportunityChanges).mockImplementation((handler) => {
      handlers.push(() => handler({ action: "add", opportunity_key: "station:34:60003760", tab: "station" }));
      return () => undefined;
    });
    render(<PinnedOpportunitiesTab />);
    await screen.findByText("Tritanium");
    const callsBefore = vi.mocked(listPinnedOpportunities).mock.calls.length;
    handlers[0]?.();
    await waitFor(() =>
      expect(vi.mocked(listPinnedOpportunities).mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});
