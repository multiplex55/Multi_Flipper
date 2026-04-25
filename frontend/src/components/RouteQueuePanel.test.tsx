import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteQueuePanel } from "@/components/RouteQueuePanel";
import type { RouteQueueEntry } from "@/lib/routeQueue";

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

describe("RouteQueuePanel", () => {
  afterEach(() => cleanup());
  it("hides done entries by default", () => {
    render(
      <RouteQueuePanel
        entries={[
          makeEntry({ routeKey: "loc:done->loc:done", routeLabel: "Done route", status: "done" }),
          makeEntry({ routeKey: "loc:active->loc:active", routeLabel: "Active route", status: "queued" }),
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Done route")).not.toBeInTheDocument();
    expect(screen.getByText("Active route")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Show done"));
    expect(screen.getByText("Done route")).toBeInTheDocument();
  });

  it("renders next action from the next non-skipped route", () => {
    render(
      <RouteQueuePanel
        entries={[
          makeEntry({ routeKey: "loc:skip->loc:skip", routeLabel: "Skip me", status: "skipped", priority: 90 }),
          makeEntry({ routeKey: "loc:next->loc:next", routeLabel: "Take me", status: "assigned", priority: 10 }),
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("route-queue-next-action")).toHaveTextContent("Take me");
  });

  it("fires workbench and batch builder actions", () => {
    const onOpenWorkbench = vi.fn();
    const onOpenBatchBuilder = vi.fn();
    render(
      <RouteQueuePanel
        entries={[makeEntry()]}
        onChange={vi.fn()}
        onOpenWorkbench={onOpenWorkbench}
        onOpenBatchBuilder={onOpenBatchBuilder}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Workbench" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Batch Builder" }));

    expect(onOpenWorkbench).toHaveBeenCalledWith("loc:1->loc:2");
    expect(onOpenBatchBuilder).toHaveBeenCalledWith("loc:1->loc:2");
  });
});
