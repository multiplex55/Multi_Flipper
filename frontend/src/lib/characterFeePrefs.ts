import type { ScanParams } from "./types";

export const CHARACTER_FEE_PREFS_STORAGE_KEY = "eve-flipper-fees-by-character:v1";

export type CharacterFeeSnapshot = Pick<
  ScanParams,
  | "sales_tax_percent"
  | "broker_fee_percent"
  | "split_trade_fees"
  | "buy_broker_fee_percent"
  | "sell_broker_fee_percent"
  | "buy_sales_tax_percent"
  | "sell_sales_tax_percent"
>;

type CharacterFeePrefsEnvelopeV1 = {
  version: 1;
  by_character: Record<string, CharacterFeeSnapshot>;
};

const FALLBACK_SNAPSHOT: CharacterFeeSnapshot = {
  sales_tax_percent: 8,
  broker_fee_percent: 0,
  split_trade_fees: false,
  buy_broker_fee_percent: 0,
  sell_broker_fee_percent: 0,
  buy_sales_tax_percent: 0,
  sell_sales_tax_percent: 8,
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeFeeSnapshot(value: unknown): CharacterFeeSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const salesTaxPercent = toFiniteNumber(candidate.sales_tax_percent);
  const brokerFeePercent = toFiniteNumber(candidate.broker_fee_percent);
  const splitTradeFees = toBoolean(candidate.split_trade_fees);
  const buyBrokerFeePercent = toFiniteNumber(candidate.buy_broker_fee_percent);
  const sellBrokerFeePercent = toFiniteNumber(candidate.sell_broker_fee_percent);
  const buySalesTaxPercent = toFiniteNumber(candidate.buy_sales_tax_percent);
  const sellSalesTaxPercent = toFiniteNumber(candidate.sell_sales_tax_percent);

  if (
    salesTaxPercent === null ||
    brokerFeePercent === null ||
    splitTradeFees === null ||
    buyBrokerFeePercent === null ||
    sellBrokerFeePercent === null ||
    buySalesTaxPercent === null ||
    sellSalesTaxPercent === null
  ) {
    return null;
  }

  return {
    sales_tax_percent: salesTaxPercent,
    broker_fee_percent: brokerFeePercent,
    split_trade_fees: splitTradeFees,
    buy_broker_fee_percent: buyBrokerFeePercent,
    sell_broker_fee_percent: sellBrokerFeePercent,
    buy_sales_tax_percent: buySalesTaxPercent,
    sell_sales_tax_percent: sellSalesTaxPercent,
  };
}

function normalizeByCharacter(value: unknown): Record<string, CharacterFeeSnapshot> {
  if (!value || typeof value !== "object") return {};

  const raw = value as Record<string, unknown>;
  const out: Record<string, CharacterFeeSnapshot> = {};
  for (const [characterId, snapshot] of Object.entries(raw)) {
    const normalized = normalizeFeeSnapshot(snapshot);
    if (!normalized) continue;
    out[characterId] = normalized;
  }

  return out;
}

function parseEnvelope(raw: string): Record<string, CharacterFeeSnapshot> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return {};

  const candidate = parsed as Record<string, unknown>;

  if (candidate.version === 1) {
    return normalizeByCharacter(candidate.by_character);
  }

  // Migration tolerance: accept legacy payloads that stored only by-character maps.
  if (candidate.by_character && typeof candidate.by_character === "object") {
    return normalizeByCharacter(candidate.by_character);
  }

  return normalizeByCharacter(candidate);
}

export function extractCharacterFeeSnapshot(params: ScanParams): CharacterFeeSnapshot {
  return {
    sales_tax_percent: params.sales_tax_percent ?? FALLBACK_SNAPSHOT.sales_tax_percent,
    broker_fee_percent: params.broker_fee_percent ?? FALLBACK_SNAPSHOT.broker_fee_percent,
    split_trade_fees: params.split_trade_fees ?? FALLBACK_SNAPSHOT.split_trade_fees,
    buy_broker_fee_percent:
      params.buy_broker_fee_percent ?? FALLBACK_SNAPSHOT.buy_broker_fee_percent,
    sell_broker_fee_percent:
      params.sell_broker_fee_percent ?? FALLBACK_SNAPSHOT.sell_broker_fee_percent,
    buy_sales_tax_percent:
      params.buy_sales_tax_percent ?? FALLBACK_SNAPSHOT.buy_sales_tax_percent,
    sell_sales_tax_percent:
      params.sell_sales_tax_percent ?? FALLBACK_SNAPSHOT.sell_sales_tax_percent,
  };
}

export function readCharacterFeeSnapshots(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): Record<string, CharacterFeeSnapshot> {
  const raw = storage.getItem(CHARACTER_FEE_PREFS_STORAGE_KEY);
  if (!raw) return {};

  try {
    return parseEnvelope(raw);
  } catch {
    return {};
  }
}

export function loadCharacterFeeSnapshot(
  characterId: number,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): CharacterFeeSnapshot | null {
  const all = readCharacterFeeSnapshots(storage);
  return all[String(characterId)] ?? null;
}

export function saveCharacterFeeSnapshot(
  characterId: number,
  snapshot: CharacterFeeSnapshot,
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
): void {
  const all = readCharacterFeeSnapshots(storage);
  all[String(characterId)] = snapshot;

  const envelope: CharacterFeePrefsEnvelopeV1 = {
    version: 1,
    by_character: all,
  };

  storage.setItem(CHARACTER_FEE_PREFS_STORAGE_KEY, JSON.stringify(envelope));
}
