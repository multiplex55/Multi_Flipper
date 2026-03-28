import { render, screen } from "@testing-library/react";
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
});
