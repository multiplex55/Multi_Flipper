import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionButton,
  ControlGroup,
  MutedLabel,
  StatusChip,
  ToggleButton,
} from "@/components/ui/ControlPrimitives";

afterEach(() => {
  cleanup();
});

describe("ControlPrimitives", () => {
  it("renders action button semantics and disabled behavior", () => {
    const onClick = vi.fn();
    render(
      <ActionButton onClick={onClick} disabled>
        Run action
      </ActionButton>,
    );

    const button = screen.getByRole("button", { name: "Run action" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders toggle button with aria-pressed and supports activation", () => {
    const onClick = vi.fn();
    render(
      <ToggleButton pressed onClick={onClick}>
        Toggle state
      </ToggleButton>,
    );

    const toggle = screen.getByRole("button", { name: "Toggle state" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);

    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Enter" });
    fireEvent.keyUp(toggle, { key: "Enter" });
    fireEvent.click(toggle);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("renders status chip as non-interactive text by default", () => {
    render(<StatusChip>Queue 4</StatusChip>);

    expect(screen.queryByRole("button", { name: "Queue 4" })).not.toBeInTheDocument();
    expect(screen.getByText("Queue 4").tagName).toBe("SPAN");
  });

  it("renders muted label as text context", () => {
    render(<MutedLabel>Context marker</MutedLabel>);

    expect(screen.getByText("Context marker")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Context marker" })).not.toBeInTheDocument();
  });

  it("applies tone and selected classes", () => {
    render(
      <ControlGroup>
        <ActionButton tone="accent" selected>
          Accent active
        </ActionButton>
        <ActionButton tone="indigo" disabled>
          Indigo disabled
        </ActionButton>
      </ControlGroup>,
    );

    expect(screen.getByRole("button", { name: "Accent active" }).className).toContain("text-eve-accent");
    expect(screen.getByRole("button", { name: "Indigo disabled" }).className).toContain("opacity-50");
  });
});
