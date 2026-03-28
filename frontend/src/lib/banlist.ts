export const BANLIST_STORAGE_KEY = "eve-flipper-banlist:v1";

export type BanlistState = {
  byId: Record<number, true>;
  entries: Array<{ typeId: number; typeName: string }>;
};

export const emptyBanlistState: BanlistState = {
  byId: {},
  entries: [],
};

function normalizeEntry(typeId: unknown, typeName: unknown): { typeId: number; typeName: string } | null {
  const normalizedTypeId = Number(typeId);
  if (!Number.isInteger(normalizedTypeId) || normalizedTypeId <= 0) return null;
  const normalizedTypeName = typeof typeName === "string" && typeName.trim() !== ""
    ? typeName.trim()
    : `Type ${normalizedTypeId}`;
  return { typeId: normalizedTypeId, typeName: normalizedTypeName };
}

export function normalizeBanlistEntries(entries: Array<{ typeId: unknown; typeName?: unknown }>): BanlistState {
  if (!Array.isArray(entries) || entries.length === 0) return emptyBanlistState;
  const byId: Record<number, true> = {};
  const normalized: Array<{ typeId: number; typeName: string }> = [];
  for (const item of entries) {
    const parsed = normalizeEntry(item?.typeId, item?.typeName);
    if (!parsed || byId[parsed.typeId]) continue;
    byId[parsed.typeId] = true;
    normalized.push(parsed);
  }
  normalized.sort((a, b) => a.typeName.localeCompare(b.typeName));
  return { byId, entries: normalized };
}

export function hydrateBanlistFromStorage(storage: Pick<Storage, "getItem"> = window.localStorage): BanlistState {
  try {
    const raw = storage.getItem(BANLIST_STORAGE_KEY);
    if (!raw) return emptyBanlistState;
    const parsed = JSON.parse(raw) as { entries?: Array<{ typeId: unknown; typeName?: unknown }> };
    return normalizeBanlistEntries(Array.isArray(parsed?.entries) ? parsed.entries : []);
  } catch {
    return emptyBanlistState;
  }
}

export function saveBanlistToStorage(
  state: BanlistState,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  storage.setItem(BANLIST_STORAGE_KEY, JSON.stringify({ entries: state.entries }));
}

export type BanlistAction =
  | { type: "hydrate"; payload: BanlistState }
  | { type: "add"; payload: { typeId: number; typeName: string } }
  | { type: "remove"; payload: { typeId: number } }
  | { type: "clear" };

export function banlistReducer(state: BanlistState, action: BanlistAction): BanlistState {
  switch (action.type) {
    case "hydrate":
      return action.payload;
    case "add": {
      const parsed = normalizeEntry(action.payload.typeId, action.payload.typeName);
      if (!parsed || state.byId[parsed.typeId]) return state;
      return normalizeBanlistEntries([...state.entries, parsed]);
    }
    case "remove": {
      if (!state.byId[action.payload.typeId]) return state;
      return normalizeBanlistEntries(state.entries.filter((entry) => entry.typeId !== action.payload.typeId));
    }
    case "clear":
      return emptyBanlistState;
    default:
      return state;
  }
}

export function isItemBanned(banlist: BanlistState, typeId: number): boolean {
  return Boolean(banlist.byId[typeId]);
}

export function filterBannedItems<T>(
  items: T[],
  banlist: BanlistState,
  getTypeId: (item: T) => number,
): T[] {
  if (items.length === 0 || banlist.entries.length === 0) return items;
  return items.filter((item) => !banlist.byId[getTypeId(item)]);
}
