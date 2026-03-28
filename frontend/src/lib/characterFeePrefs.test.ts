import { describe, expect, it, vi } from "vitest";
import {
  CHARACTER_FEE_PREFS_STORAGE_KEY,
  loadCharacterFeeSnapshot,
  readCharacterFeeSnapshots,
  saveCharacterFeeSnapshot,
  type CharacterFeeSnapshot,
} from "@/lib/characterFeePrefs";

function makeSnapshot(overrides: Partial<CharacterFeeSnapshot> = {}): CharacterFeeSnapshot {
  return {
    sales_tax_percent: 8,
    broker_fee_percent: 1,
    split_trade_fees: false,
    buy_broker_fee_percent: 0,
    sell_broker_fee_percent: 1,
    buy_sales_tax_percent: 0,
    sell_sales_tax_percent: 8,
    ...overrides,
  };
}

function makeStorage(seed?: string): Pick<Storage, "getItem" | "setItem"> {
  let value = seed ?? null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
  };
}

describe("characterFeePrefs", () => {
  it("returns empty map for invalid JSON", () => {
    const storage = makeStorage("{broken") as Pick<Storage, "getItem">;
    expect(readCharacterFeeSnapshots(storage)).toEqual({});
  });

  it("reads v1 envelope and validates snapshots", () => {
    const payload = JSON.stringify({
      version: 1,
      by_character: {
        "1001": makeSnapshot({ sales_tax_percent: 3 }),
        "1002": { bogus: true },
      },
    });
    const storage = makeStorage(payload) as Pick<Storage, "getItem">;

    expect(readCharacterFeeSnapshots(storage)).toEqual({
      "1001": makeSnapshot({ sales_tax_percent: 3 }),
    });
  });

  it("supports legacy by-character payloads for migration tolerance", () => {
    const legacyPayload = JSON.stringify({
      "2001": makeSnapshot({ broker_fee_percent: 2.5 }),
      "2002": { nope: 1 },
    });
    const storage = makeStorage(legacyPayload) as Pick<Storage, "getItem">;

    expect(loadCharacterFeeSnapshot(2001, storage)).toEqual(
      makeSnapshot({ broker_fee_percent: 2.5 }),
    );
    expect(loadCharacterFeeSnapshot(2002, storage)).toBeNull();
  });

  it("writes snapshots in v1 envelope keyed by character_id", () => {
    const storage = makeStorage();
    saveCharacterFeeSnapshot(3001, makeSnapshot({ split_trade_fees: true }), storage);
    saveCharacterFeeSnapshot(3002, makeSnapshot({ sales_tax_percent: 5 }), storage);

    expect(storage.setItem).toHaveBeenCalled();
    const setItemCalls = (storage.setItem as ReturnType<typeof vi.fn>).mock.calls;
    const latestCall = setItemCalls[setItemCalls.length - 1];
    const latestRaw = latestCall?.[1];
    expect(typeof latestRaw).toBe("string");

    const parsed = JSON.parse(latestRaw as string) as {
      version: number;
      by_character: Record<string, CharacterFeeSnapshot>;
    };

    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.by_character)).toEqual(["3001", "3002"]);
    expect(parsed.by_character["3002"].sales_tax_percent).toBe(5);
    expect(latestCall?.[0]).toBe(CHARACTER_FEE_PREFS_STORAGE_KEY);
  });
});
