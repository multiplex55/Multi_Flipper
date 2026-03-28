import { describe, expect, it } from "vitest";
import {
  banlistReducer,
  emptyBanlistState,
  filterBannedItems,
  hydrateBanlistFromStorage,
  isItemBanned,
  saveBanlistToStorage,
} from "@/lib/banlist";

describe("banlistReducer", () => {
  it("adds, dedupes, removes, and clears entries", () => {
    const added = banlistReducer(emptyBanlistState, {
      type: "add",
      payload: { typeId: 34, typeName: "Tritanium" },
    });
    expect(added.entries).toHaveLength(1);
    expect(isItemBanned(added, 34)).toBe(true);

    const deduped = banlistReducer(added, {
      type: "add",
      payload: { typeId: 34, typeName: "Tritanium" },
    });
    expect(deduped.entries).toHaveLength(1);

    const removed = banlistReducer(deduped, {
      type: "remove",
      payload: { typeId: 34 },
    });
    expect(removed.entries).toHaveLength(0);

    const cleared = banlistReducer(
      banlistReducer(removed, { type: "add", payload: { typeId: 35, typeName: "Pyerite" } }),
      { type: "clear" },
    );
    expect(cleared.entries).toHaveLength(0);
  });
});

describe("banlist persistence", () => {
  it("serializes and hydrates from storage", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
    };

    const state = banlistReducer(emptyBanlistState, {
      type: "add",
      payload: { typeId: 44992, typeName: "PLEX" },
    });
    saveBanlistToStorage(state, storage);
    const hydrated = hydrateBanlistFromStorage(storage);

    expect(hydrated.entries).toEqual([{ typeId: 44992, typeName: "PLEX" }]);
    expect(isItemBanned(hydrated, 44992)).toBe(true);
  });
});

describe("banlist selectors", () => {
  it("filters banned IDs from candidate lists", () => {
    const state = banlistReducer(emptyBanlistState, {
      type: "add",
      payload: { typeId: 35, typeName: "Pyerite" },
    });
    const items = [
      { TypeID: 34, TypeName: "Tritanium" },
      { TypeID: 35, TypeName: "Pyerite" },
    ];

    const filtered = filterBannedItems(items, state, (item) => item.TypeID);
    expect(filtered).toEqual([{ TypeID: 34, TypeName: "Tritanium" }]);
  });
});
