import { executionQualityForFlip, exitOverhangDays } from "@/lib/executionQuality";
import { classifyRadiusDealRisk } from "@/lib/radiusDealRisk";
import type { FlipResult } from "@/lib/types";

const STORAGE_KEY = "eve-decision-candidate-patterns:v1";
const MAX_SAVED_PATTERNS = 30;

type LegacySavedCandidatePattern = {
  id: string;
  label: string;
  tab: "routes" | "station" | "contracts";
  query: string;
  pinned: boolean;
  updatedAt: string;
};

export type SavedCandidatePatternBase = {
  id: string;
  label: string;
  query: string;
  pinned: boolean;
  updatedAt: string;
};

export type RadiusPatternApplicationMode = "filter" | "boost";

export type RadiusLocationPattern = {
  locationId?: number;
  stationName?: string;
  systemName?: string;
};

export type RadiusSavedDealPattern = SavedCandidatePatternBase & {
  tab: "radius";
  patternType: "deal";
  applicationMode: RadiusPatternApplicationMode;
  boostScore?: number;
  item?: {
    typeId?: number;
    typeName?: string;
  };
  buy?: RadiusLocationPattern;
  sell?: RadiusLocationPattern;
  minProfit?: number;
  minIskPerJump?: number;
  minExecutionQuality?: number;
  maxTrapRisk?: number;
  maxTurnoverDays?: number;
  requireFill?: boolean;
  requireHistory?: boolean;
};

export type SavedCandidatePattern =
  | LegacySavedCandidatePattern
  | RadiusSavedDealPattern;

export type RadiusPatternMatchResult = {
  matched: boolean;
  reasons: string[];
  executionQuality: number;
  trapRisk: number;
  turnoverDays: number;
};

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizePattern(value: unknown): SavedCandidatePattern | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SavedCandidatePattern>;
  if (!candidate.id || !candidate.label || !candidate.updatedAt || !candidate.tab) {
    return null;
  }

  if (candidate.tab === "radius") {
    const radius = candidate as Partial<RadiusSavedDealPattern>;
    if (radius.patternType !== "deal") return null;
    const mode =
      radius.applicationMode === "boost" || radius.applicationMode === "filter"
        ? radius.applicationMode
        : "filter";
    return {
      id: String(radius.id),
      label: String(radius.label),
      query: String(radius.query ?? ""),
      pinned: Boolean(radius.pinned),
      updatedAt: String(radius.updatedAt),
      tab: "radius",
      patternType: "deal",
      applicationMode: mode,
      boostScore: Number.isFinite(radius.boostScore) ? Number(radius.boostScore) : undefined,
      item: radius.item,
      buy: radius.buy,
      sell: radius.sell,
      minProfit: Number.isFinite(radius.minProfit) ? Number(radius.minProfit) : undefined,
      minIskPerJump: Number.isFinite(radius.minIskPerJump)
        ? Number(radius.minIskPerJump)
        : undefined,
      minExecutionQuality: Number.isFinite(radius.minExecutionQuality)
        ? Number(radius.minExecutionQuality)
        : undefined,
      maxTrapRisk: Number.isFinite(radius.maxTrapRisk) ? Number(radius.maxTrapRisk) : undefined,
      maxTurnoverDays: Number.isFinite(radius.maxTurnoverDays)
        ? Number(radius.maxTurnoverDays)
        : undefined,
      requireFill: radius.requireFill === true,
      requireHistory: radius.requireHistory === true,
    };
  }

  if (candidate.tab === "routes" || candidate.tab === "station" || candidate.tab === "contracts") {
    return {
      id: String(candidate.id),
      label: String(candidate.label),
      query: String(candidate.query ?? ""),
      pinned: Boolean(candidate.pinned),
      updatedAt: String(candidate.updatedAt),
      tab: candidate.tab,
    };
  }

  return null;
}

export function loadSavedCandidatePatterns(): SavedCandidatePattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizePattern(item))
      .filter((item): item is SavedCandidatePattern => item !== null);
  } catch {
    return [];
  }
}

export function saveCandidatePattern(input: Omit<SavedCandidatePattern, "id" | "updatedAt">): SavedCandidatePattern[] {
  const current = loadSavedCandidatePatterns();
  const id = `${input.tab}:${toSlug(input.label)}:${toSlug(input.query || "pattern")}`;
  const nextPattern: SavedCandidatePattern = {
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  } as SavedCandidatePattern;
  const filtered = current.filter((item) => item.id !== nextPattern.id);
  const next = [nextPattern, ...filtered].slice(0, MAX_SAVED_PATTERNS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function isRadiusSavedDealPattern(pattern: SavedCandidatePattern): pattern is RadiusSavedDealPattern {
  return pattern.tab === "radius";
}

function textIncludes(haystack: string | null | undefined, needle: string): boolean {
  if (!needle.trim()) return true;
  return String(haystack ?? "").toLowerCase().includes(needle.trim().toLowerCase());
}

export function matchesRadiusType(
  row: Pick<FlipResult, "TypeID" | "TypeName">,
  pattern: Pick<RadiusSavedDealPattern, "item">,
): boolean {
  const item = pattern.item;
  if (!item) return true;
  if (item.typeId != null && item.typeId > 0 && Number(row.TypeID) !== Number(item.typeId)) {
    return false;
  }
  if (item.typeName && !textIncludes(row.TypeName, item.typeName)) {
    return false;
  }
  return true;
}

export function matchesRadiusEndpoint(
  row: Pick<FlipResult, "BuyLocationID" | "BuyStation" | "BuySystemName" | "SellLocationID" | "SellStation" | "SellSystemName">,
  endpoint: "buy" | "sell",
  locationPattern?: RadiusLocationPattern,
): boolean {
  if (!locationPattern) return true;
  const locationId = endpoint === "buy" ? row.BuyLocationID : row.SellLocationID;
  const station = endpoint === "buy" ? row.BuyStation : row.SellStation;
  const system = endpoint === "buy" ? row.BuySystemName : row.SellSystemName;

  if (
    locationPattern.locationId != null &&
    locationPattern.locationId > 0 &&
    Number(locationId ?? 0) !== Number(locationPattern.locationId)
  ) {
    return false;
  }
  if (locationPattern.stationName && !textIncludes(station, locationPattern.stationName)) {
    return false;
  }
  if (locationPattern.systemName && !textIncludes(system, locationPattern.systemName)) {
    return false;
  }
  return true;
}

function turnoverDaysForRow(row: FlipResult): number {
  const supply = row.TargetSellSupply ?? row.DayTargetSupplyUnits ?? 0;
  const throughput = row.S2BPerDay ?? row.DayTargetDemandPerDay ?? row.DailyVolume ?? 0;
  return exitOverhangDays(supply, throughput);
}

export function matchRadiusDealPattern(row: FlipResult, pattern: RadiusSavedDealPattern): RadiusPatternMatchResult {
  const reasons: string[] = [];
  const executionQuality = executionQualityForFlip(row).score;
  const trapRisk = classifyRadiusDealRisk(row).score;
  const turnoverDays = turnoverDaysForRow(row);

  if (!matchesRadiusType(row, pattern)) reasons.push("type");
  if (!matchesRadiusEndpoint(row, "buy", pattern.buy)) reasons.push("buy");
  if (!matchesRadiusEndpoint(row, "sell", pattern.sell)) reasons.push("sell");

  if ((row.ExpectedProfit ?? row.RealProfit ?? row.TotalProfit ?? 0) < (pattern.minProfit ?? Number.NEGATIVE_INFINITY)) {
    reasons.push("min_profit");
  }
  if ((row.ProfitPerJump ?? 0) < (pattern.minIskPerJump ?? Number.NEGATIVE_INFINITY)) {
    reasons.push("min_isk_jump");
  }
  if (executionQuality < (pattern.minExecutionQuality ?? Number.NEGATIVE_INFINITY)) {
    reasons.push("min_execution_quality");
  }
  if (trapRisk > (pattern.maxTrapRisk ?? Number.POSITIVE_INFINITY)) {
    reasons.push("max_trap_risk");
  }
  if (turnoverDays > (pattern.maxTurnoverDays ?? Number.POSITIVE_INFINITY)) {
    reasons.push("max_turnover");
  }

  if (pattern.requireFill && row.CanFill === false) {
    reasons.push("require_fill");
  }

  const hasHistory =
    row.HistoryAvailable === true ||
    (row.DayTargetPeriodPrice ?? 0) > 0 ||
    (row.DayPriceHistory?.length ?? 0) > 0;
  if (pattern.requireHistory && !hasHistory) {
    reasons.push("require_history");
  }

  return {
    matched: reasons.length === 0,
    reasons,
    executionQuality,
    trapRisk,
    turnoverDays,
  };
}

export function createRadiusSavedDealPattern(
  row: FlipResult,
  input: {
    label: string;
    applicationMode: RadiusPatternApplicationMode;
    item?: RadiusSavedDealPattern["item"];
    buy?: RadiusSavedDealPattern["buy"];
    sell?: RadiusSavedDealPattern["sell"];
    minProfit?: number;
    minIskPerJump?: number;
    minExecutionQuality?: number;
    maxTrapRisk?: number;
    maxTurnoverDays?: number;
    requireFill?: boolean;
    requireHistory?: boolean;
    boostScore?: number;
    query?: string;
  },
): Omit<RadiusSavedDealPattern, "id" | "updatedAt"> {
  const fallbackItem = { typeId: row.TypeID, typeName: row.TypeName };
  const buy = {
    locationId: row.BuyLocationID,
    stationName: row.BuyStation,
    systemName: row.BuySystemName,
  };
  const sell = {
    locationId: row.SellLocationID,
    stationName: row.SellStation,
    systemName: row.SellSystemName,
  };
  return {
    tab: "radius",
    patternType: "deal",
    label: input.label,
    query:
      input.query ??
      `${fallbackItem.typeName} | ${buy.stationName ?? buy.systemName ?? "buy"} -> ${sell.stationName ?? sell.systemName ?? "sell"}`,
    pinned: true,
    applicationMode: input.applicationMode,
    boostScore: input.boostScore,
    item: input.item,
    buy: input.buy,
    sell: input.sell,
    minProfit: input.minProfit,
    minIskPerJump: input.minIskPerJump,
    minExecutionQuality: input.minExecutionQuality,
    maxTrapRisk: input.maxTrapRisk,
    maxTurnoverDays: input.maxTurnoverDays,
    requireFill: input.requireFill,
    requireHistory: input.requireHistory,
  };
}

export function radiusPatternBoostScore(pattern: RadiusSavedDealPattern): number {
  return pattern.boostScore ?? 15;
}
