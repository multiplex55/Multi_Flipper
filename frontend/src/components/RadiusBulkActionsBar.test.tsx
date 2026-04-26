import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadiusBulkActionsBar } from "@/components/RadiusBulkActionsBar";
import type { FlipResult } from "@/lib/types";

const row = { TypeID: 1, TypeName: "Item" } as FlipResult;

describe("RadiusBulkActionsBar", () => {
  it("renders nothing when no selection", () => {
    const { container } = render(
      <RadiusBulkActionsBar
        selectedRows={[]}
        selectedRouteKeys={[]}
        onClear={vi.fn()}
        onVerifyRoutes={vi.fn()}
        onQueueRoutes={vi.fn()}
        onAssignRoutes={vi.fn()}
        onHideRows={vi.fn()}
        onTrackRows={vi.fn()}
        onExportRows={vi.fn()}
        onCopyRows={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("wires bulk action callbacks", () => {
    const onQueueRoutes = vi.fn();
    render(
      <RadiusBulkActionsBar
        selectedRows={[row, row]}
        selectedRouteKeys={["a"]}
        onClear={vi.fn()}
        onVerifyRoutes={vi.fn()}
        onQueueRoutes={onQueueRoutes}
        onAssignRoutes={vi.fn()}
        onHideRows={vi.fn()}
        onTrackRows={vi.fn()}
        onExportRows={vi.fn()}
        onCopyRows={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    expect(onQueueRoutes).toHaveBeenCalledTimes(1);
  });
});
