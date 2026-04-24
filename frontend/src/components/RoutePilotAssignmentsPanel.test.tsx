import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoutePilotAssignmentsPanel } from "@/components/RoutePilotAssignmentsPanel";

vi.mock("@/lib/api", () => ({
  getCharacterLocation: vi.fn(async () => null),
}));

describe("RoutePilotAssignmentsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("assigns pilot and updates status", () => {
    render(<RoutePilotAssignmentsPanel routeKey="route-1" routeLabel="Jita → Amarr" />);

    fireEvent.change(screen.getByLabelText("Assigned pilot"), {
      target: { value: "Pilot One" },
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

  it("edits notes/system fields", () => {
    render(<RoutePilotAssignmentsPanel routeKey="route-2" />);

    fireEvent.change(screen.getByLabelText("Assigned pilot"), {
      target: { value: "Pilot Two" },
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

  it("unassign behavior", () => {
    render(<RoutePilotAssignmentsPanel routeKey="route-3" />);

    fireEvent.change(screen.getByLabelText("Assigned pilot"), {
      target: { value: "Pilot Three" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    fireEvent.click(screen.getByRole("button", { name: "Unassign" }));

    expect(screen.getByLabelText("Assigned pilot")).toHaveValue("");
    expect(screen.queryByTestId("route-assignment-status-chip")).not.toBeInTheDocument();
  });
});
