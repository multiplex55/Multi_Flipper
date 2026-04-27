import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlipResult } from "@/lib/types";
import { RadiusRowContextMenu } from "@/components/RadiusRowContextMenu";

function makeRow(overrides: Partial<FlipResult> = {}): FlipResult {
  return {
    TypeID: 501,
    TypeName: "Test Item",
    BuyStation: "Jita",
    SellStation: "Amarr",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    SellSystemID: 30002187,
    BuyLocationID: 60003760,
    SellLocationID: 60008494,
    BuyRegionID: 10000002,
    SellRegionID: 10000043,
    ...overrides,
  } as FlipResult;
}

describe("RadiusRowContextMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders expected sections and dispatches click callbacks", () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <RadiusRowContextMenu
        x={10}
        y={20}
        row={makeRow()}
        surface="radius_route"
        isLoggedIn
        isTracked={false}
        isPinned={false}
        hasLegLocks
        canQueueRoute
        canAssignRoute
        canVerifyRoute
        onClose={onClose}
        callbacks={{ onAction }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill Cargo" }));
    expect(onAction).toHaveBeenCalledWith("fill_cargo", expect.objectContaining({ TypeID: 501 }), expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on escape", () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <RadiusRowContextMenu
        x={10}
        y={20}
        row={makeRow()}
        surface="radius_table"
        isLoggedIn
        isTracked={false}
        isPinned={false}
        hasLegLocks={false}
        canQueueRoute={false}
        canAssignRoute={false}
        canVerifyRoute={false}
        onClose={onClose}
        callbacks={{ onAction }}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("suppresses invalid-row actions and keeps queue callback route-key safe", () => {
    const onAction = vi.fn();
    render(
      <RadiusRowContextMenu
        x={10}
        y={20}
        row={makeRow({ BuyLocationID: 0, SellLocationID: 0 })}
        surface="radius_route"
        isLoggedIn
        isTracked={false}
        isPinned={false}
        hasLegLocks={false}
        canQueueRoute
        canAssignRoute
        canVerifyRoute={false}
        onClose={() => undefined}
        callbacks={{ onAction }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Ignore this buy station (session)" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Queue route" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign best pilot" }));
    expect(onAction).toHaveBeenCalledWith("queue_route", expect.anything(), expect.any(String));
    expect(onAction).toHaveBeenCalledWith("assign_route_best", expect.anything(), expect.any(String));
  });

  it("shows saved-pattern actions and dispatches apply action", () => {
    const onAction = vi.fn();
    render(
      <RadiusRowContextMenu
        x={10}
        y={20}
        row={makeRow()}
        surface="radius_table"
        isLoggedIn
        isTracked={false}
        isPinned={false}
        hasLegLocks={false}
        canQueueRoute={false}
        canAssignRoute={false}
        canVerifyRoute={false}
        onClose={() => undefined}
        callbacks={{ onAction }}
      />,
    );

    expect(screen.getByRole("button", { name: "Save item pattern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save buy station pattern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save sell station pattern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save route pattern" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply saved pattern" }));
    expect(onAction).toHaveBeenCalledWith("apply_saved_pattern", expect.objectContaining({ TypeID: 501 }), expect.any(String));
  });

  it("shows route workflow actions only on route surface", () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    const row = makeRow();

    const { rerender } = render(
      <RadiusRowContextMenu
        x={10}
        y={20}
        row={row}
        surface="radius_table"
        isLoggedIn
        isTracked={false}
        isPinned={false}
        hasLegLocks={false}
        canQueueRoute
        canAssignRoute
        canVerifyRoute
        onClose={onClose}
        callbacks={{ onAction }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Queue route" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign route" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign active pilot" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign best pilot" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Verify now" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add route to compare" })).toBeNull();

    rerender(
      <RadiusRowContextMenu
        x={10}
        y={20}
        row={row}
        surface="radius_route"
        isLoggedIn={false}
        isTracked={false}
        isPinned={false}
        hasLegLocks={false}
        canQueueRoute
        canAssignRoute
        canVerifyRoute
        onClose={onClose}
        callbacks={{ onAction }}
      />,
    );

    expect(screen.getByRole("button", { name: "Queue route" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Assign route" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Assign active pilot" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Assign best pilot" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Verify now" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add route to compare" })).toBeEnabled();
  });

  it("keeps scanner triage actions available on table surface", () => {
    const onAction = vi.fn();
    render(
      <RadiusRowContextMenu
        x={10}
        y={20}
        row={makeRow()}
        surface="radius_table"
        isLoggedIn
        isTracked={false}
        isPinned={false}
        hasLegLocks
        canQueueRoute={false}
        canAssignRoute={false}
        canVerifyRoute={false}
        onClose={() => undefined}
        callbacks={{ onAction }}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy item" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Build batch" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Fill Cargo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Lock this buy" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Lock this sell" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Clear locks" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ignore this buy station (session)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ignore this sell station (session)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "🎯 Set destination (Buy)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "🎯 Set destination (Sell)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pin row" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save item pattern" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save route pattern" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply saved pattern" })).toBeEnabled();
  });
});
