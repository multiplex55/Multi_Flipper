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
        isLoggedIn={false}
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
        isLoggedIn={false}
        isTracked={false}
        isPinned={false}
        hasLegLocks={false}
        canQueueRoute
        canAssignRoute={false}
        canVerifyRoute={false}
        onClose={() => undefined}
        callbacks={{ onAction }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Ignore this buy station (session)" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Queue route" }));
    expect(onAction).toHaveBeenCalledWith("queue_route", expect.anything(), expect.any(String));
  });
});
