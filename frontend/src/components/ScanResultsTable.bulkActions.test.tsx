import { describe, expect, it, vi } from "vitest";
import { addRouteKeyToCompare, dedupeRouteKeys } from "@/components/ScanResultsTable";
import { RadiusBulkActionsBar } from "@/components/RadiusBulkActionsBar";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FlipResult } from "@/lib/types";

describe("ScanResultsTable bulk action helpers", () => {
  it("dedupes route keys for queue/verify dispatch", () => {
    expect(dedupeRouteKeys(["a", "a", "b", "", "b"])).toEqual(["a", "b"]);
  });

  it("dedupes and enforces max compare routes", () => {
    let next: string[] = [];
    next = addRouteKeyToCompare(next, "r1", 4);
    next = addRouteKeyToCompare(next, "r1", 4);
    next = addRouteKeyToCompare(next, "r2", 4);
    next = addRouteKeyToCompare(next, "r3", 4);
    next = addRouteKeyToCompare(next, "r4", 4);
    next = addRouteKeyToCompare(next, "r5", 4);
    expect(next).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("bulk bar dispatches queue/verify only once per click", () => {
    const onQueueRoutes = vi.fn();
    const onVerifyRoutes = vi.fn();
    render(
      <RadiusBulkActionsBar
        selectedRows={[{ TypeID: 1 } as FlipResult]}
        selectedRouteKeys={["route-a"]}
        onClear={vi.fn()}
        onVerifyRoutes={onVerifyRoutes}
        onQueueRoutes={onQueueRoutes}
        onAssignRoutes={vi.fn()}
        onHideRows={vi.fn()}
        onTrackRows={vi.fn()}
        onExportRows={vi.fn()}
        onCopyRows={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(onQueueRoutes).toHaveBeenCalledTimes(1);
    expect(onVerifyRoutes).toHaveBeenCalledTimes(1);
  });
});
