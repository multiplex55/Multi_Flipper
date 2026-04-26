import {
  hasDestinationPriceSpike,
  hasStableDestinationHistory,
  requestedUnitsForFlip,
} from "@/lib/executionQuality";
import type { FlipResult } from "@/lib/types";

export type RadiusDealRiskLabel = "Low" | "Medium" | "High" | "Extreme";

export type RadiusDealRisk = {
  score: number;
  label: RadiusDealRiskLabel;
  reasons: string[];
};

type PenaltyReason = {
  penalty: number;
  text: string;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function classifyRadiusDealRisk(row: FlipResult): RadiusDealRisk {
  const reasons: PenaltyReason[] = [];
  const categoryTotals = new Map<string, number>();
  let total = 0;

  const addPenalty = (category: string, cap: number, amount: number, text: string): void => {
    if (amount <= 0 || !Number.isFinite(amount)) return;
    const current = categoryTotals.get(category) ?? 0;
    const remaining = Math.max(0, cap - current);
    if (remaining <= 0) return;
    const applied = Math.min(amount, remaining);
    if (applied <= 0) return;
    categoryTotals.set(category, current + applied);
    total += applied;
    reasons.push({ penalty: applied, text });
  };

  const plannedUnits = Math.max(0, requestedUnitsForFlip(row));
  const filledUnits = Math.max(0, Number(row.FilledQty ?? 0));
  const dailyVolume = Math.max(0, Number(row.DailyVolume ?? 0));
  const buyDepth = Math.max(0, Number(row.BuyOrderRemain ?? 0));
  const sellDepth = Math.max(0, Number(row.SellOrderRemain ?? 0));
  const shallowDepth = Math.min(buyDepth, sellDepth);

  const hasHistory =
    row.HistoryAvailable === true ||
    (row.DayTargetPeriodPrice ?? 0) > 0 ||
    (row.DayPriceHistory?.length ?? 0) >= 5;
  if (!hasHistory) {
    addPenalty("history", 20, 20, "Missing market history");
  }

  if (dailyVolume <= 0) {
    addPenalty("volume", 25, 25, "No daily volume");
  } else if (dailyVolume < Math.max(5, plannedUnits * 0.5)) {
    addPenalty("volume", 25, 14, "Low daily volume");
  }

  if (plannedUnits > 0) {
    if (dailyVolume > 0 && plannedUnits > dailyVolume) {
      addPenalty("size_depth", 20, 12, "Planned units exceed daily flow");
    }
    if (shallowDepth > 0 && plannedUnits > shallowDepth) {
      addPenalty("size_depth", 20, 12, "Planned units exceed depth support");
    }
  }

  const slippagePct = Math.max(0, Number(row.SlippageBuyPct ?? 0) + Number(row.SlippageSellPct ?? 0));
  if (slippagePct >= 12) {
    addPenalty("slippage", 20, 20, "Very high slippage");
  } else if (slippagePct >= 6) {
    addPenalty("slippage", 20, 13, "High slippage");
  } else if (slippagePct >= 3) {
    addPenalty("slippage", 20, 7, "Moderate slippage");
  }

  const marginPct = Math.max(0, Number(row.MarginPercent ?? 0));
  const lowLiquidity = dailyVolume > 0 && plannedUnits > 0 && dailyVolume < plannedUnits * 1.5;
  if (marginPct >= 18 && lowLiquidity) {
    addPenalty("margin_liquidity", 12, 12, "High margin with thin liquidity");
  }

  const fillRatio = plannedUnits > 0 ? clamp(filledUnits / plannedUnits, 0, 1) : row.CanFill ? 1 : 0;
  if (row.CanFill === false) {
    addPenalty("fillability", 18, 18, "Modeled size cannot fully fill");
  } else if (fillRatio < 0.7) {
    addPenalty("fillability", 18, 12, "Weak fillability");
  }

  if (buyDepth > 0 && sellDepth > 0) {
    const depthRatio = Math.max(buyDepth, sellDepth) / Math.max(1, Math.min(buyDepth, sellDepth));
    if (depthRatio >= 4) {
      addPenalty("fillability", 18, 8, "Buy/sell depth imbalance");
    }
  }

  if (hasDestinationPriceSpike(row)) {
    addPenalty("stability", 15, 10, "Recent profit behavior is unstable");
  }
  if (hasStableDestinationHistory(row) === false) {
    addPenalty("stability", 15, 9, "Recent price behavior is unstable");
  }

  const score = clamp(Math.round(total), 0, 100);
  const label: RadiusDealRiskLabel =
    score >= 75 ? "Extreme" : score >= 50 ? "High" : score >= 25 ? "Medium" : "Low";

  return {
    score,
    label,
    reasons: reasons
      .sort((a, b) => b.penalty - a.penalty)
      .slice(0, 4)
      .map((entry) => entry.text),
  };
}
