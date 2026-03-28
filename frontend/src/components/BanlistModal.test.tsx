import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BanlistModal } from "@/components/BanlistModal";
import { emptyBanlistState } from "@/lib/banlist";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("BanlistModal", () => {
  afterEach(() => {
    cleanup();
  });

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

  it("shows suggestions from raw results even when filtered display data is missing those rows", () => {
    render(
      <BanlistModal
        banlist={emptyBanlistState}
        latestResults={[
          { TypeID: 34, TypeName: "Tritanium" } as never,
          { TypeID: 35, TypeName: "Pyerite" } as never,
        ]}
        routeResults={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Pyerite/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tritanium/i })).toBeInTheDocument();
  });

  it("re-surfaces an item in suggestions immediately after removing it from banlist", () => {
    let state = {
      byId: { 34: true } as Record<number, true>,
      entries: [{ typeId: 34, typeName: "Tritanium" }],
    };
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

    expect(screen.queryByRole("button", { name: /Tritanium/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "banlistRemove" }));
    expect(onRemove).toHaveBeenCalledWith(34);
    expect(screen.getByRole("button", { name: /Tritanium/i })).toBeInTheDocument();
  });

  it("collects nested hop items as suggestions", () => {
    render(
      <BanlistModal
        banlist={emptyBanlistState}
        latestResults={[]}
        routeResults={[
          {
            Hops: [{ TypeID: 34, TypeName: "Tritanium", Items: [{ TypeID: 35, TypeName: "Pyerite" }, { TypeID: 36, TypeName: "Mexallon" }] }],
          } as never,
        ]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Tritanium/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pyerite/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mexallon/i })).toBeInTheDocument();
  });

  it("dedupes suggestions when the same type appears in scan rows and route items", () => {
    render(
      <BanlistModal
        banlist={emptyBanlistState}
        latestResults={[{ TypeID: 34, TypeName: "Tritanium" } as never]}
        routeResults={[
          {
            Hops: [{ TypeID: 100, TypeName: "Different", Items: [{ TypeID: 34, TypeName: "Tritanium" }] }],
          } as never,
        ]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Tritanium/i })).toHaveLength(1);
  });

  it("matches suggestions by partial name and numeric type id", () => {
    render(
      <BanlistModal
        banlist={emptyBanlistState}
        latestResults={[{ TypeID: 34, TypeName: "Tritanium" } as never, { TypeID: 35, TypeName: "Pyerite" } as never]}
        routeResults={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("banlistSearchPlaceholder"), { target: { value: "trit" } });
    expect(screen.getByRole("button", { name: /Tritanium/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pyerite/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("banlistSearchPlaceholder"), { target: { value: "35" } });
    expect(screen.getByRole("button", { name: /Pyerite/i })).toBeInTheDocument();
  });

  it("clear-all empties banlist and restores candidates without closing modal", () => {
    let state = {
      byId: { 34: true } as Record<number, true>,
      entries: [{ typeId: 34, typeName: "Tritanium" }],
    };
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
    const onClear = vi.fn(() => {
      state = emptyBanlistState;
      rerender();
    });

    const view = render(
      <BanlistModal
        banlist={state}
        latestResults={[{ TypeID: 34, TypeName: "Tritanium" } as never]}
        routeResults={[]}
        onAdd={onAdd}
        onRemove={onRemove}
        onClear={onClear}
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
          onClear={onClear}
        />,
      );

    fireEvent.change(screen.getByPlaceholderText("banlistSearchPlaceholder"), { target: { value: "zzz" } });
    fireEvent.click(screen.getByRole("button", { name: "banlistClearAll" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByText("banlistEmpty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tritanium/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tritanium/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
