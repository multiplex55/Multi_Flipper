import type { FlipResult } from "@/lib/types";

const STRUCTURE_LOCATION_ID_THRESHOLD = 1_000_000_000_000;

export type EndpointPreferenceProfile = {
  buyHubPenalty: number;
  nonHubBuyBonus: number;
  sellStructureBonus: number;
  routeDirectionBonus: number;
  deadheadPenalty: number;
  requireSellStructure: boolean;
  requireSellNpc: boolean;
  requireNonHubBuy: boolean;
  requireHubSell: boolean;
};

export enum EndpointPreferenceApplicationMode {
  Disabled = "disabled",
  RankOnly = "rank_only",
  Hide = "hide",
  Deprioritize = "rank_only",
}

export type EndpointPreferenceMode = EndpointPreferenceApplicationMode;

export type EndpointPreferenceRuleResult = {
  rule: string;
  scoreDelta: number;
};

export type EndpointPreferenceEvaluation = {
  scoreDelta: number;
  appliedRules: string[];
  excluded: boolean;
  excludedReasons: string[];
};

export type EndpointEndpointType =
  | "structure"
  | "npc"
  | "hub"
  | "non_hub"
  | "unknown";

export const DEFAULT_MAJOR_HUB_SYSTEMS = [
  "Jita",
  "Amarr",
  "Dodixie",
  "Rens",
  "Hek",
] as const;

export const DEFAULT_ENDPOINT_PREFERENCE_PROFILE: EndpointPreferenceProfile = {
  buyHubPenalty: -12,
  nonHubBuyBonus: 6,
  sellStructureBonus: 7,
  routeDirectionBonus: 5,
  deadheadPenalty: -8,
  requireSellStructure: false,
  requireSellNpc: false,
  requireNonHubBuy: false,
  requireHubSell: false,
};

export const ENDPOINT_PREFERENCE_PRESETS: Record<
  "neutral" | "safe_arbitrage" | "structure_exit" | "low_attention",
  EndpointPreferenceProfile
> = {
  neutral: {
    buyHubPenalty: 0,
    nonHubBuyBonus: 0,
    sellStructureBonus: 0,
    routeDirectionBonus: 0,
    deadheadPenalty: 0,
    requireSellStructure: false,
    requireSellNpc: false,
    requireNonHubBuy: false,
    requireHubSell: false,
  },
  safe_arbitrage: {
    buyHubPenalty: -16,
    nonHubBuyBonus: 4,
    sellStructureBonus: 3,
    routeDirectionBonus: 9,
    deadheadPenalty: -15,
    requireSellStructure: false,
    requireSellNpc: false,
    requireNonHubBuy: false,
    requireHubSell: false,
  },
  structure_exit: {
    buyHubPenalty: -6,
    nonHubBuyBonus: 5,
    sellStructureBonus: 16,
    routeDirectionBonus: 6,
    deadheadPenalty: -6,
    requireSellStructure: true,
    requireSellNpc: false,
    requireNonHubBuy: false,
    requireHubSell: false,
  },
  low_attention: {
    buyHubPenalty: -10,
    nonHubBuyBonus: 2,
    sellStructureBonus: 2,
    routeDirectionBonus: 3,
    deadheadPenalty: -18,
    requireSellStructure: false,
    requireSellNpc: false,
    requireNonHubBuy: false,
    requireHubSell: false,
  },
};

const KNOWN_STRUCTURE_MARKERS = [
  "Astrahus",
  "Fortizar",
  "Keepstar",
  "Raitaru",
  "Azbel",
  "Sotiyo",
  "Athanor",
  "Tatara",
  "Ansiblex",
  "Tenebrex",
  "Pharolux",
  "Metenox",
  "Skyhook",
];

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeMajorHubSystems(systems: string[]): string[] {
  const uniq = new Set<string>();
  for (const system of systems) {
    const normalized = system.trim();
    if (normalized.length > 0) {
      uniq.add(normalized);
    }
  }
  return [...uniq];
}

export function isMajorHubSystem(
  systemName: string | undefined,
  majorHubSystems: string[],
): boolean {
  const system = normalizeName(systemName);
  if (system.length === 0) return false;
  return majorHubSystems.some((hub) => normalizeName(hub) === system);
}

export function isLikelyStructureStation(stationName: string | undefined): boolean {
  const station = stationName?.trim() ?? "";
  if (station.length === 0) return false;
  return KNOWN_STRUCTURE_MARKERS.some((marker) => station.includes(marker));
}

export function isStructureLocationID(locationID: number | undefined): boolean {
  const numericLocationID = Math.trunc(Number(locationID ?? 0));
  return numericLocationID > STRUCTURE_LOCATION_ID_THRESHOLD;
}

function isNpcLocationID(locationID: number | undefined): boolean {
  const numericLocationID = Math.trunc(Number(locationID ?? 0));
  return numericLocationID > 0 && !isStructureLocationID(numericLocationID);
}

export function classifyBuyEndpointType(
  row: FlipResult,
  majorHubSystems: string[],
): EndpointEndpointType {
  const buyLocationID = row.BuyLocationID;
  if ((buyLocationID ?? 0) > 0) {
    if (isStructureLocationID(buyLocationID)) return "structure";
    if (isNpcLocationID(buyLocationID)) return "npc";
  }
  if (isMajorHubSystem(row.BuySystemName, majorHubSystems)) return "hub";
  if (normalizeName(row.BuySystemName).length > 0) return "non_hub";
  return "unknown";
}

export function classifySellEndpointType(
  row: FlipResult,
  majorHubSystems: string[],
): EndpointEndpointType {
  const sellLocationID = row.SellLocationID;
  if ((sellLocationID ?? 0) > 0) {
    if (isStructureLocationID(sellLocationID)) return "structure";
    if (isNpcLocationID(sellLocationID)) return "npc";
  }
  if (isLikelyStructureStation(row.SellStation)) return "structure";
  if (isMajorHubSystem(row.SellSystemName, majorHubSystems)) return "hub";
  if (normalizeName(row.SellSystemName).length > 0) return "non_hub";
  return "unknown";
}

function classifySellEndpoint(row: FlipResult, majorHubSystems: string[]): {
  type: EndpointEndpointType;
  isStructure: boolean;
  isNpc: boolean;
} {
  const type = classifySellEndpointType(row, majorHubSystems);
  return {
    type,
    isStructure: type === "structure",
    isNpc: type === "npc",
  };
}

function evaluateHardConstraintViolations(
  row: FlipResult,
  profile: EndpointPreferenceProfile,
  majorHubSystems: string[],
): string[] {
  const reasons: string[] = [];
  const buyIsHub = isMajorHubSystem(row.BuySystemName, majorHubSystems);
  const sellIsHub = isMajorHubSystem(row.SellSystemName, majorHubSystems);
  const sellEndpoint = classifySellEndpoint(row, majorHubSystems);

  if (profile.requireNonHubBuy && buyIsHub) {
    reasons.push("hard_require_non_hub_buy");
  }
  if (profile.requireHubSell && !sellIsHub) {
    reasons.push("hard_require_hub_sell");
  }
  if (profile.requireSellStructure && !sellEndpoint.isStructure) {
    reasons.push("hard_require_sell_structure");
  }
  if (profile.requireSellNpc && !sellEndpoint.isNpc) {
    reasons.push("hard_require_sell_npc");
  }

  return reasons;
}

export function evaluateEndpointPreferenceRules(
  row: FlipResult,
  profile: EndpointPreferenceProfile,
  majorHubSystems: string[],
): EndpointPreferenceRuleResult[] {
  const buyIsHub = isMajorHubSystem(row.BuySystemName, majorHubSystems);
  const sellIsHub = isMajorHubSystem(row.SellSystemName, majorHubSystems);
  const sellEndpoint = classifySellEndpoint(row, majorHubSystems);

  const results: EndpointPreferenceRuleResult[] = [];
  if (buyIsHub && profile.buyHubPenalty !== 0) {
    results.push({
      rule: "buy_hub_penalty",
      scoreDelta: profile.buyHubPenalty,
    });
  }
  if (!buyIsHub && profile.nonHubBuyBonus !== 0) {
    results.push({
      rule: "non_hub_buy_bonus",
      scoreDelta: profile.nonHubBuyBonus,
    });
  }
  if (sellEndpoint.isStructure && profile.sellStructureBonus !== 0) {
    results.push({
      rule: "sell_structure_bonus",
      scoreDelta: profile.sellStructureBonus,
    });
  }
  if (!buyIsHub && sellIsHub && profile.routeDirectionBonus !== 0) {
    results.push({
      rule: "route_direction_bonus",
      scoreDelta: profile.routeDirectionBonus,
    });
  }
  if (!buyIsHub && !sellIsHub && profile.deadheadPenalty !== 0) {
    results.push({
      rule: "deadhead_penalty",
      scoreDelta: profile.deadheadPenalty,
    });
  }
  return results;
}

export function evaluateEndpointPreferences(
  row: FlipResult,
  profile: EndpointPreferenceProfile,
  majorHubSystems: string[],
  mode: EndpointPreferenceApplicationMode,
): EndpointPreferenceEvaluation {
  if (mode === EndpointPreferenceApplicationMode.Disabled) {
    return {
      scoreDelta: 0,
      excluded: false,
      excludedReasons: [],
      appliedRules: [],
    };
  }
  const softRuleResults = evaluateEndpointPreferenceRules(row, profile, majorHubSystems);
  const scoreDelta = softRuleResults.reduce((sum, entry) => sum + entry.scoreDelta, 0);
  const excludedReasons = evaluateHardConstraintViolations(
    row,
    profile,
    majorHubSystems,
  );
  const excluded =
    mode === EndpointPreferenceApplicationMode.Hide && excludedReasons.length > 0;
  return {
    scoreDelta,
    excluded,
    excludedReasons,
    appliedRules: softRuleResults.map((entry) => entry.rule),
  };
}
