import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoutePilotAssignmentsPanel } from "@/components/RoutePilotAssignmentsPanel";
import { getCharacterLocation } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getCharacterLocation: vi.fn(async () => null),
}));

const characters = [
  { character_id: 101, character_name: "Pilot One", active: true },
  { character_id: 102, character_name: "Pilot Two", active: true },
];

describe("RoutePilotAssignmentsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it("assigns pilot and updates status", () => {
    render(
      <RoutePilotAssignmentsPanel
        routeKey="route-1"
        routeLabel="Jita → Amarr"
        characters={characters}
      />,
    );

    fireEvent.change(screen.getByLabelText("Assigned character"), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    expect(screen.getByTestId("route-assignment-status-chip")).toHaveTextContent(
      "queued",
    );

    fireEvent.change(screen.getByLabelText("Assignment status"), {
      target: { value: "buying" },
    });
    expect(screen.getByTestId("route-assignment-status-chip")).toHaveTextContent(
      "buying",
    );
  });

  it("renders auth characters in dropdown", () => {
    render(
      <RoutePilotAssignmentsPanel
        routeKey="route-characters"
        characters={characters}
        characterLocations={{ 101: "Jita" }}
      />,
    );
    const select = screen.getByLabelText("Assigned character");
    expect(select).toHaveTextContent("Pilot One · Jita");
    expect(select).toHaveTextContent("Pilot Two");
  });

  it("edits notes/system fields", () => {
    render(<RoutePilotAssignmentsPanel routeKey="route-2" characters={characters} />);

    fireEvent.change(screen.getByLabelText("Assigned character"), {
      target: { value: "102" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    fireEvent.change(screen.getByLabelText("Current system"), {
      target: { value: "Jita" },
    });
    fireEvent.change(screen.getByLabelText("Staged system"), {
      target: { value: "Perimeter" },
    });
    fireEvent.change(screen.getByLabelText("Assignment notes"), {
      target: { value: "Buy then haul" },
    });

    expect(screen.getByLabelText("Current system")).toHaveValue("Jita");
    expect(screen.getByLabelText("Staged system")).toHaveValue("Perimeter");
    expect(screen.getByLabelText("Assignment notes")).toHaveValue("Buy then haul");
  });

  it("refreshes location using assigned character id", async () => {
    vi.mocked(getCharacterLocation).mockResolvedValue({
      solar_system_id: 30000142,
      solar_system_name: "Jita",
      station_name: "Jita IV - Moon 4",
    });

    render(<RoutePilotAssignmentsPanel routeKey="route-3" characters={characters} />);

    fireEvent.change(screen.getByLabelText("Assigned character"), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh location" }));

    await waitFor(() => {
      expect(getCharacterLocation).toHaveBeenCalledWith(101);
    });
  });

  it("unassign behavior", () => {
    render(<RoutePilotAssignmentsPanel routeKey="route-4" characters={characters} />);

    fireEvent.change(screen.getByLabelText("Assigned character"), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    fireEvent.click(screen.getByRole("button", { name: "Unassign" }));

    expect(screen.getByLabelText("Assigned character")).toHaveValue("");
    expect(screen.queryByTestId("route-assignment-status-chip")).not.toBeInTheDocument();
  });

  it("manual assignment entry continues to work without character id in storage", () => {
    localStorage.setItem(
      "eve-route-assignments:v1",
      JSON.stringify([
        {
          routeKey: "route-legacy",
          assignedCharacterName: "Pilot One",
          status: "queued",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );
    render(<RoutePilotAssignmentsPanel routeKey="route-legacy" characters={characters} />);
    fireEvent.change(screen.getByLabelText("Assignment notes"), {
      target: { value: "legacy edited" },
    });
    expect(screen.getByLabelText("Assignment notes")).toHaveValue("legacy edited");
  });
});
