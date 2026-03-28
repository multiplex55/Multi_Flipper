import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteBuilder } from "@/components/RouteBuilder";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => ({ copyRoute: "Copy route", copyRouteSystems: "Copy route systems" }[key] ?? key),
  }),
}));
vi.mock("@/components/Toast", () => ({
  useGlobalToast: () => ({ addToast: vi.fn() }),
}));

describe("RouteBuilder route details", () => {
  it("renders multi-item controls and persists edited quantities", async () => {
    render(
      <RouteBuilder
        params={{ system_name: "Jita", cargo_capacity: 0, buy_radius: 1, sell_radius: 1, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 }}
        loadedResults={[
          {
            Hops: [{
              TypeID: 34,
              TypeName: "Tritanium",
              SystemName: "Jita",
              DestSystemName: "Amarr",
              BuyPrice: 10,
              SellPrice: 20,
              Units: 10,
              Profit: 100,
              Jumps: 1,
              SystemID: 1,
              DestSystemID: 2,
              Items: [
                { TypeID: 34, TypeName: "Tritanium", Units: 10, BuyPrice: 10, SellPrice: 20, Profit: 100 },
                { TypeID: 35, TypeName: "Pyerite", Units: 5, BuyPrice: 8, SellPrice: 16, Profit: 40 },
              ],
            }],
            TotalProfit: 140,
            TotalJumps: 1,
            ProfitPerJump: 140,
            HopCount: 1,
          },
        ] as never}
      />,
    );

    fireEvent.doubleClick(screen.getAllByTitle("Jita → Amarr")[0]);

    const qtyInput = screen.getByLabelText("qty-0-35") as HTMLInputElement;
    expect(qtyInput.value).toBe("5");
    fireEvent.change(qtyInput, { target: { value: "3" } });
    expect(qtyInput.value).toBe("3");

    fireEvent.click(screen.getByRole("button", { name: /Hide items/i }));
    fireEvent.click(screen.getByRole("button", { name: /Show items/i }));
    expect((screen.getByLabelText("qty-0-35") as HTMLInputElement).value).toBe("3");
  });

  it("expand/collapse shows hop items and subtotals", () => {
    render(
      <RouteBuilder
        params={{ system_name: "Jita", cargo_capacity: 0, buy_radius: 1, sell_radius: 1, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 }}
        loadedResults={[
          {
            Hops: [{
              TypeID: 34,
              TypeName: "Tritanium",
              SystemName: "Jita",
              DestSystemName: "Amarr",
              BuyPrice: 10,
              SellPrice: 20,
              Units: 10,
              Profit: 100,
              Jumps: 1,
              SystemID: 1,
              DestSystemID: 2,
              Items: [
                { TypeID: 34, TypeName: "Tritanium", Units: 10, BuyPrice: 10, SellPrice: 20, Profit: 100 },
                { TypeID: 35, TypeName: "Pyerite", Units: 5, BuyPrice: 8, SellPrice: 16, Profit: 40 },
              ],
            }],
            TotalProfit: 140,
            TotalJumps: 1,
            ProfitPerJump: 140,
            HopCount: 1,
          },
        ] as never}
      />,
    );

    fireEvent.doubleClick(screen.getAllByTitle("Jita → Amarr")[0]);
    expect(screen.queryByTestId("hop-items-0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hide items/i }));
    expect(screen.queryByTestId("hop-items-0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show items/i }));
    expect(screen.getByTestId("hop-items-0")).toBeInTheDocument();
    expect(screen.getByText(/Subtotal: buy/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hide items/i }));
    expect(screen.queryByTestId("hop-items-0")).not.toBeInTheDocument();
  });

  it("renders summary analytics cards and updates hop real profit when item composition changes", () => {
    render(
      <RouteBuilder
        params={{ system_name: "Jita", cargo_capacity: 0, buy_radius: 1, sell_radius: 1, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 }}
        loadedResults={[
          {
            Hops: [{
              TypeID: 34,
              TypeName: "Tritanium",
              SystemName: "Jita",
              DestSystemName: "Amarr",
              BuyPrice: 10,
              SellPrice: 20,
              Units: 10,
              Profit: 100,
              Jumps: 2,
              SystemID: 1,
              DestSystemID: 2,
              Items: [
                { TypeID: 34, TypeName: "Tritanium", Units: 10, BuyPrice: 10, SellPrice: 20, Profit: 100 },
                { TypeID: 35, TypeName: "Pyerite", Units: 5, BuyPrice: 8, SellPrice: 16, Profit: 40 },
              ],
            }],
            TotalProfit: 140,
            TotalJumps: 2,
            ProfitPerJump: 70,
            HopCount: 1,
          },
        ] as never}
      />,
    );

    fireEvent.doubleClick(screen.getAllByTitle("Jita → Amarr")[0]);

    const metricsPanel = screen.getByTestId("route-summary-metrics");
    expect(within(metricsPanel).getByText("Profit margin %")).toBeInTheDocument();
    expect(within(metricsPanel).getByText("Avg ISK/Jump (hops)")).toBeInTheDocument();
    expect(within(metricsPanel).getByText("Hop profit range")).toBeInTheDocument();
    expect(within(metricsPanel).getByText("Break-even jumps")).toBeInTheDocument();
    expect(within(metricsPanel).getByText("Top route item")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show items/i }));
    expect(within(screen.getByTestId("hop-items-0")).getByText(/real profit/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("qty-0-35"), { target: { value: "0" } });
    const subtotalUpdated = within(screen.getByTestId("hop-items-0")).getByText((content) => content.includes("real profit") && content.includes("100"));
    expect(subtotalUpdated).toBeInTheDocument();
  });

  it("matches route details summary snapshot", () => {
    const { asFragment } = render(
      <RouteBuilder
        params={{ system_name: "Jita", cargo_capacity: 0, buy_radius: 1, sell_radius: 1, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 }}
        loadedResults={[
          {
            Hops: [{
              TypeID: 34,
              TypeName: "Tritanium",
              SystemName: "Jita",
              DestSystemName: "Amarr",
              BuyPrice: 10,
              SellPrice: 20,
              Units: 10,
              Profit: 100,
              Jumps: 2,
              SystemID: 1,
              DestSystemID: 2,
              Items: [{ TypeID: 34, TypeName: "Tritanium", Units: 10, BuyPrice: 10, SellPrice: 20, Profit: 100 }],
            }],
            TotalProfit: 100,
            TotalJumps: 2,
            ProfitPerJump: 50,
            HopCount: 1,
          },
        ] as never}
      />,
    );

    fireEvent.doubleClick(screen.getAllByTitle("Jita → Amarr")[0]);
    expect(asFragment()).toMatchSnapshot();
  });

  it("copies route details using manifest labels and excludes legacy copy fragments", async () => {
    const writeText = vi.fn<(_: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <RouteBuilder
        params={{ system_name: "Jita", cargo_capacity: 0, buy_radius: 1, sell_radius: 1, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 }}
        loadedResults={[
          {
            Hops: [
              {
                TypeID: 34,
                TypeName: "Tritanium",
                StationName: "Jita IV - Moon 4",
                SystemName: "Jita",
                DestStationName: "Perimeter - Tranquility",
                DestSystemName: "Perimeter",
                BuyPrice: 10,
                SellPrice: 20,
                Units: 10,
                Profit: 100,
                Jumps: 2,
                EmptyJumps: 1,
                SystemID: 30000142,
                DestSystemID: 30000144,
                Items: [
                  { TypeID: 34, TypeName: "Tritanium", Units: 10, BuyPrice: 10, SellPrice: 20, Profit: 100 },
                  { TypeID: 35, TypeName: "Pyerite", Units: 5, BuyPrice: 8, SellPrice: 12, Profit: 20 },
                ],
              },
            ],
            TotalProfit: 120,
            TotalJumps: 3,
            ProfitPerJump: 40,
            HopCount: 1,
          },
        ] as never}
      />,
    );

    fireEvent.doubleClick(screen.getAllByTitle("Jita → Perimeter")[0]);
    const copyRouteButtonLabels = screen.getAllByText("Copy route");
    fireEvent.click(copyRouteButtonLabels[copyRouteButtonLabels.length - 1].closest("button") as HTMLButtonElement);

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Buy Station:");
    expect(copied).toContain("Jumps to Buy Station:");
    expect(copied).toContain("Sell Station:");
    expect(copied).toContain("Jumps Buy -> Sell:");
    expect(copied).toContain("Total capital:");
    expect(copied).not.toContain("=== EVE Flipper Route ===");
    expect(copied).not.toContain("[1]");
    expect(copied).not.toContain("Buy: Tritanium x10");
  });
});
