import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteBuilder } from "@/components/RouteBuilder";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string, vars?: Record<string, unknown>) => (key === "routeFound" ? `found:${vars?.count}` : key) }),
}));
vi.mock("@/components/Toast", () => ({
  useGlobalToast: () => ({ addToast: vi.fn() }),
}));

describe("RouteBuilder banlist filtering", () => {
  it("hides routes containing only banned items", () => {
    render(
      <RouteBuilder
        params={{ system_name: "Jita", cargo_capacity: 0, buy_radius: 1, sell_radius: 1, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 }}
        loadedResults={[
          {
            Hops: [{ TypeID: 34, TypeName: "Tritanium", SystemName: "Jita", DestSystemName: "Amarr", BuyPrice: 1, SellPrice: 2, Units: 1, Profit: 1, Jumps: 1, BuyStation: "A", SellStation: "B", SystemID: 1, DestSystemID: 2 }],
            TotalProfit: 1,
            TotalJumps: 1,
            ProfitPerJump: 1,
            HopCount: 1,
          },
        ] as never}
        banlist={{ byId: { 34: true }, entries: [{ typeId: 34, typeName: "Tritanium" }] }}
      />,
    );

    expect(screen.queryByText(/found:1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jita/)).not.toBeInTheDocument();
  });

  it("removes banned items from multi-item hops", () => {
    render(
      <RouteBuilder
        params={{ system_name: "Jita", cargo_capacity: 0, buy_radius: 1, sell_radius: 1, min_margin: 0, sales_tax_percent: 0, broker_fee_percent: 0 }}
        loadedResults={[
          {
            Hops: [{
              TypeID: 35,
              TypeName: "Pyerite",
              SystemName: "Jita",
              DestSystemName: "Amarr",
              BuyPrice: 1,
              SellPrice: 2,
              Units: 1,
              Profit: 2,
              Jumps: 1,
              SystemID: 1,
              DestSystemID: 2,
              Items: [
                { TypeID: 34, TypeName: "Tritanium", Units: 5, BuyPrice: 1, SellPrice: 2, Profit: 5 },
                { TypeID: 35, TypeName: "Pyerite", Units: 2, BuyPrice: 1, SellPrice: 3, Profit: 4 },
              ],
            }],
            TotalProfit: 9,
            TotalJumps: 1,
            ProfitPerJump: 9,
            HopCount: 1,
          },
        ] as never}
        banlist={{ byId: { 34: true }, entries: [{ typeId: 34, typeName: "Tritanium" }] }}
      />,
    );

    expect(screen.getByText(/found:1/i)).toBeInTheDocument();
    expect(screen.getByText(/Jita/)).toBeInTheDocument();
    expect(screen.getAllByText(/^4$/)).toHaveLength(2);

    fireEvent.doubleClick(screen.getAllByTitle("Jita → Amarr")[0]);
    expect(screen.getAllByText("4 ISK").length).toBeGreaterThan(0);
  });
});
