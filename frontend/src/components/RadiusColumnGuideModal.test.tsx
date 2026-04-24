import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { RadiusColumnGuideModal } from "@/components/RadiusColumnGuideModal";
import { radiusColumnRegistry } from "@/lib/radiusColumnRegistry";

afterEach(() => {
  document.body.innerHTML = "";
});

function renderModal(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <I18nProvider>
        <RadiusColumnGuideModal open onClose={onClose} />
      </I18nProvider>,
    ),
  };
}

describe("RadiusColumnGuideModal", () => {
  it("renders modal content and scroll container", async () => {
    renderModal();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("radius-column-guide-scroll")).toBeInTheDocument();
    expect(screen.getByText("FLIPPER (RADIUS) Column Guide")).toBeInTheDocument();
  });

  it("renders registry categories and entries", () => {
    renderModal();

    const categories = Array.from(new Set(radiusColumnRegistry.map((entry) => entry.category)));
    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories.slice(0, 3)) {
      expect(screen.getByText(category)).toBeInTheDocument();
    }

    const urgency = radiusColumnRegistry.find((entry) => entry.key === "UrgencyScore");
    expect(urgency).toBeDefined();
    expect(screen.getAllByText(urgency!.title, { exact: false }).length).toBeGreaterThan(0);
  });

  it("closes on escape", () => {
    const { onClose } = renderModal();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay click", async () => {
    const { onClose } = renderModal();

    const overlay = (await screen.findAllByRole("dialog"))[0];
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
