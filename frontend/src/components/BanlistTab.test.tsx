import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BanlistTab } from "@/components/BanlistTab";
import type { BanlistItem, BannedStation } from "@/lib/types";

const addToast = vi.fn();

const apiMocks = vi.hoisted(() => ({
  getBanlistItems: vi.fn(),
  getBannedStations: vi.fn(),
  addBanlistItem: vi.fn(),
  removeBanlistItem: vi.fn(),
  addBannedStation: vi.fn(),
  removeBannedStation: vi.fn(),
  getSystemsList: vi.fn(),
  getStations: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en" }),
}));

vi.mock("@/components/Toast", () => ({
  useGlobalToast: () => ({ addToast }),
}));

vi.mock("@/lib/api", () => apiMocks);

const initialItems: BanlistItem[] = [
  { type_id: 34, type_name: "Tritanium", added_at: "2026-01-01T00:00:00Z" },
];
const initialStations: BannedStation[] = [
  {
    location_id: 60003760,
    station_name: "Jita 4-4",
    system_id: 30000142,
    system_name: "Jita",
    added_at: "2026-01-01T00:00:00Z",
  },
];

const latestResults = [
  {
    TypeID: 34,
    TypeName: "Tritanium",
    Volume: 0,
    BuyPrice: 0,
    BuyStation: "Jita 4-4",
    BuySystemName: "Jita",
    BuySystemID: 30000142,
    BuyLocationID: 60003760,
    SellPrice: 0,
    SellStation: "Perimeter Trade Hub",
    SellSystemName: "Perimeter",
    SellSystemID: 30000144,
    SellLocationID: 60015000,
    ProfitPerUnit: 0,
    MarginPercent: 0,
    UnitsToBuy: 0,
    BuyOrderRemain: 0,
    SellOrderRemain: 0,
    TotalProfit: 0,
    ProfitPerJump: 0,
    BuyJumps: 0,
    SellJumps: 0,
    TotalJumps: 0,
    DailyVolume: 0,
    Velocity: 0,
    PriceTrend: 0,
    BuyCompetitors: 0,
    SellCompetitors: 0,
    DailyProfit: 0,
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  apiMocks.getBanlistItems.mockResolvedValue(initialItems);
  apiMocks.getBannedStations.mockResolvedValue(initialStations);
  apiMocks.addBanlistItem.mockResolvedValue({ items: initialItems, inserted: true });
  apiMocks.removeBanlistItem.mockResolvedValue([]);
  apiMocks.addBannedStation.mockResolvedValue({ stations: initialStations, inserted: true });
  apiMocks.removeBannedStation.mockResolvedValue([]);
  apiMocks.getSystemsList.mockResolvedValue([{ id: 30000142, name: "Jita", security: 0.9, region_id: 10000002 }]);
  apiMocks.getStations.mockResolvedValue({
    stations: [{ id: 60015000, name: "Perimeter Trade Hub", system_id: 30000144, region_id: 10000002 }],
    region_id: 10000002,
    system_id: 30000144,
  });
});

describe("BanlistTab", () => {
  it("loads initial item and station lists", async () => {
    render(<BanlistTab latestResults={latestResults} />);

    await waitFor(() => {
      expect(apiMocks.getBanlistItems).toHaveBeenCalled();
      expect(apiMocks.getBannedStations).toHaveBeenCalled();
    });

    expect(screen.getByText("Tritanium")).toBeInTheDocument();
    expect(screen.getByText("Jita 4-4")).toBeInTheDocument();
  });

  it("adds item to banlist", async () => {
    apiMocks.addBanlistItem.mockResolvedValue({
      items: [...initialItems, { type_id: 35, type_name: "Pyerite", added_at: "2026-01-02T00:00:00Z" }],
      inserted: true,
    });
    render(<BanlistTab latestResults={[...latestResults, { ...latestResults[0], TypeID: 35, TypeName: "Pyerite" }]} />);

    fireEvent.change(screen.getByLabelText("banlistItemSearch"), { target: { value: "Pyerite" } });
    fireEvent.click(screen.getByRole("button", { name: "banlistAddItem" }));

    await waitFor(() => {
      expect(apiMocks.addBanlistItem).toHaveBeenCalledWith(35, "Pyerite");
    });
  });

  it("removes item from banlist", async () => {
    render(<BanlistTab latestResults={latestResults} />);

    await waitFor(() => expect(screen.getByText("Tritanium")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "banlistRemove" })[0]);

    await waitFor(() => {
      expect(apiMocks.removeBanlistItem).toHaveBeenCalledWith(34);
    });
  });

  it("adds station to banlist", async () => {
    apiMocks.addBannedStation.mockResolvedValue({
      stations: [
        ...initialStations,
        {
          location_id: 60015000,
          station_name: "Perimeter Trade Hub",
          system_id: 30000144,
          system_name: "Perimeter",
          added_at: "2026-01-02T00:00:00Z",
        },
      ],
      inserted: true,
    });

    render(<BanlistTab latestResults={latestResults} />);

    fireEvent.change(screen.getByLabelText("banlistStationSearch"), { target: { value: "Perimeter Trade Hub" } });
    fireEvent.click(screen.getByRole("button", { name: "banlistAddStation" }));

    await waitFor(() => {
      expect(apiMocks.addBannedStation).toHaveBeenCalledWith({
        location_id: 60015000,
        station_name: "Perimeter Trade Hub",
        system_id: 30000144,
        system_name: "Perimeter",
      });
    });
  });

  it("removes station from banlist", async () => {
    render(<BanlistTab latestResults={latestResults} />);

    await waitFor(() => expect(screen.getByText("Jita 4-4")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "banlistRemove" })[1]);

    await waitFor(() => {
      expect(apiMocks.removeBannedStation).toHaveBeenCalledWith(60003760);
    });
  });

  it("surfaces API errors in toasts", async () => {
    apiMocks.addBanlistItem.mockRejectedValue(new Error("boom"));
    render(<BanlistTab latestResults={latestResults} />);

    fireEvent.change(screen.getByLabelText("banlistItemSearch"), { target: { value: "Tritanium" } });
    fireEvent.click(screen.getByRole("button", { name: "banlistAddItem" }));

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith("banlistAddItemError", "error", 3000);
    });
  });
});
