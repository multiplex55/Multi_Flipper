import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PinnedOpportunitiesTab } from "@/components/PinnedOpportunitiesTab";
import { listPinnedOpportunities, listPinnedOpportunitySnapshots } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listPinnedOpportunities: vi.fn(async () => []),
  listPinnedOpportunitySnapshots: vi.fn(async () => []),
}));

const pinned = [
  {
    user_id: "u",
    opportunity_key: "station:34:60003760",
    tab: "station",
    payload_json: "{}",
    created_at: "2026-04-04T00:00:00Z",
    updated_at: "2026-04-04T00:00:00Z",
    payload: { metrics: { profit: 1_000_000, margin: 10, volume: 500, route_risk: 2 } },
  },
];

const snapshots = [
  { id: 1, user_id: "u", opportunity_key: "station:34:60003760", snapshot_label: "scan:100", snapshot_at: "2026-04-04T11:00:00Z", metrics_json: "{}", metrics: { profit: 900_000, margin: 9, volume: 450, route_risk: 3 } },
  { id: 2, user_id: "u", opportunity_key: "station:34:60003760", snapshot_label: "custom:a", snapshot_at: "2026-04-03T10:00:00Z", metrics_json: "{}", metrics: { profit: 700_000, margin: 7, volume: 400, route_risk: 4 } },
];

describe("PinnedOpportunitiesTab", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(listPinnedOpportunities).mockResolvedValue(pinned as never);
    vi.mocked(listPinnedOpportunitySnapshots).mockResolvedValue(snapshots as never);
    window.history.replaceState({}, "", "/");
  });

  it("renders pinned rows from API", async () => {
    render(<PinnedOpportunitiesTab />);
    expect(await screen.findByText("station:34:60003760")).toBeInTheDocument();
  });

  it("compare filter changes recompute deltas for last/custom/24h", async () => {
    render(<PinnedOpportunitiesTab />);
    await screen.findAllByText("station:34:60003760");

    expect(screen.getAllByLabelText(/Increase: 100 K/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByDisplayValue("Last scan"), { target: { value: "custom" } });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "custom:a" } });
    await waitFor(() => expect(screen.getByLabelText(/Increase: 300 K/i)).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue("Custom snapshot"), { target: { value: "h24" } });
    await waitFor(() => expect(screen.getByText(/scan:100|custom:a/)).toBeInTheDocument());
  });

  it("trend classes/icons match sign of delta and formatting helpers output", async () => {
    render(<PinnedOpportunitiesTab />);
    await screen.findAllByText("station:34:60003760");
    expect(screen.getAllByText(/▲/).length).toBeGreaterThan(0);
    expect(screen.getByText("1 M")).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
  });

  it("uses stable keys without duplicate key warning on rerender", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = render(<PinnedOpportunitiesTab />);
    await screen.findAllByText("station:34:60003760");
    rerender(<PinnedOpportunitiesTab />);
    await screen.findAllByText("station:34:60003760");
    expect(err.mock.calls.join("\n")).not.toContain("Each child in a list should have a unique \"key\"");
    err.mockRestore();
  });
});
