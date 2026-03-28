import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BanlistModal } from "@/components/BanlistModal";
import { emptyBanlistState } from "@/lib/banlist";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("BanlistModal", () => {
  it("adds item then removes it", () => {
    let state = emptyBanlistState;
    const onAdd = vi.fn((item: { typeId: number; typeName: string }) => {
      state = {
        byId: { ...state.byId, [item.typeId]: true },
        entries: [...state.entries, item],
      };
      rerender();
    });
    const onRemove = vi.fn((typeId: number) => {
      state = {
        byId: Object.fromEntries(Object.entries(state.byId).filter(([id]) => Number(id) !== typeId)) as Record<number, true>,
        entries: state.entries.filter((item) => item.typeId !== typeId),
      };
      rerender();
    });

    const view = render(
      <BanlistModal
        banlist={state}
        latestResults={[{ TypeID: 34, TypeName: "Tritanium" } as never]}
        routeResults={[]}
        onAdd={onAdd}
        onRemove={onRemove}
        onClear={vi.fn()}
      />,
    );

    const rerender = () =>
      view.rerender(
        <BanlistModal
          banlist={state}
          latestResults={[{ TypeID: 34, TypeName: "Tritanium" } as never]}
          routeResults={[]}
          onAdd={onAdd}
          onRemove={onRemove}
          onClear={vi.fn()}
        />,
      );

    fireEvent.click(screen.getByRole("button", { name: /Tritanium/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Tritanium")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "banlistRemove" }));
    expect(onRemove).toHaveBeenCalledWith(34);
  });
});
