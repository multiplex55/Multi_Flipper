export type RadiusColumnApplicability = "row" | "route" | "both";

export type RadiusColumnGuideCopy = {
  whatItIs: string;
  whyImportant: string;
  goodValue: string;
  ideaFlipHeuristic: string;
};

export type RadiusColumnRegistryEntry = {
  key: string;
  title: string;
  tooltip: string;
  guideCopy: RadiusColumnGuideCopy;
  category: string;
  applicability: RadiusColumnApplicability;
  formatHint?: string;
};

export const radiusColumnRegistry: RadiusColumnRegistryEntry[] = [
  {
    key: "BuyPrice",
    title: "Best Ask (L1)",
    tooltip: "The cheapest current sell order in the buy market. Anchors your entry price and fill speed.",
    category: "Market Depth",
    applicability: "row",
    guideCopy: {
      whatItIs: "The cheapest current sell order in the buy market (top of book).",
      whyImportant: "This anchors your entry price and defines how quickly you can acquire inventory.",
      goodValue: "Lower relative to target-side sell prices and close to historical average (not a temporary spike).",
      ideaFlipHeuristic: "Prefer stable asks with enough L1 depth to fill most of your planned size without chasing up.",
    },
  },
  {
    key: "BestAskQty",
    title: "L1 Ask Qty",
    tooltip: "Units available at best ask. Thin L1 depth often means worse real entry prices.",
    category: "Market Depth",
    applicability: "row",
    formatHint: "integer",
    guideCopy: {
      whatItIs: "Units available at the single best ask price right now.",
      whyImportant: "Low L1 depth means your real fill price may be worse than the headline ask.",
      goodValue: "Enough to fill at least 50-100% of your intended quantity at the top level.",
      ideaFlipHeuristic: "If L1 quantity is thin, reduce size or use expected fill metrics over top-book metrics.",
    },
  },
  {
    key: "ExpectedBuyPrice",
    title: "Avg Buy Fill",
    tooltip: "Estimated average buy after depth impact at shown size.",
    category: "Market Depth",
    applicability: "row",
    guideCopy: {
      whatItIs: "Estimated average purchase price after considering order-book depth for your shown size.",
      whyImportant: "This is more realistic than Best Ask for medium/large fills.",
      goodValue: "Close to Best Ask (small spread impact), typically under 1-2% slippage for liquid items.",
      ideaFlipHeuristic: "Large gap vs Best Ask usually means hidden slippage risk; size down or skip.",
    },
  },
  {
    key: "SellPrice",
    title: "Best Bid (L1)",
    tooltip: "Top destination buy order. Sets immediate exit value.",
    category: "Market Depth",
    applicability: "row",
    guideCopy: {
      whatItIs: "Highest current buy order in the destination market (top of book).",
      whyImportant: "Defines immediate exit value and top-book profit potential.",
      goodValue: "Comfortably above expected buy fill plus fees, with consistent demand behind it.",
      ideaFlipHeuristic: "Treat isolated high bids cautiously unless depth and flow confirm they are real liquidity.",
    },
  },
  {
    key: "BestBidQty",
    title: "L1 Bid Qty",
    tooltip: "Units at best bid. Small size can disappear quickly and drag exits lower.",
    category: "Market Depth",
    applicability: "row",
    formatHint: "integer",
    guideCopy: {
      whatItIs: "Units currently bid at the best bid price level.",
      whyImportant: "Small bid size can vanish quickly and force sales into worse prices.",
      goodValue: "Can absorb a meaningful share of your planned sell size without stepping down levels.",
      ideaFlipHeuristic: "If bid depth is thin, assume lower realized exits and focus on Daily Profit quality metrics.",
    },
  },
  {
    key: "ExpectedSellPrice",
    title: "Avg Sell Fill",
    tooltip: "Estimated average exit after bid-depth impact.",
    category: "Market Depth",
    applicability: "row",
    guideCopy: {
      whatItIs: "Estimated average sale price after considering bid-side depth at your selected quantity.",
      whyImportant: "This captures likely liquidation reality, not best-case top-book exits.",
      goodValue: "Close to Best Bid with limited depth erosion; persistent gaps indicate fragile demand.",
      ideaFlipHeuristic: "Use this with Avg Buy Fill for sizing; avoid trades where both sides degrade heavily.",
    },
  },
  {
    key: "MarginPercent",
    title: "Margin %",
    tooltip: "Gross spread buffer before full execution frictions.",
    category: "Profitability",
    applicability: "row",
    formatHint: "percent",
    guideCopy: {
      whatItIs: "Gross percentage spread between buy and sell sides before or around fee assumptions.",
      whyImportant: "Higher margin gives buffer against fees, slippage, and short-term price moves.",
      goodValue: "Often 8-15%+ for safer flips; under ~5% is usually fragile unless turnover is exceptional.",
      ideaFlipHeuristic: "Combine margin with execution quality; high margin alone can be a trap in thin books.",
    },
  },
  {
    key: "IskPerM3",
    title: "ISK/m³",
    tooltip: "Profit efficiency by cargo volume.",
    category: "Execution & Sizing",
    applicability: "row",
    formatHint: "isk_per_m3",
    guideCopy: {
      whatItIs: "Estimated profit per cubic meter of cargo for the selected execution size.",
      whyImportant: "Shows how efficiently each m³ of cargo is monetized.",
      goodValue: "Higher than your alternative routes/items for the same ship class.",
      ideaFlipHeuristic: "Prioritize high ISK/m³ when cargo hold is your primary bottleneck.",
    },
  },
  {
    key: "UnitsToBuy",
    title: "Units to Buy",
    tooltip: "Recommended position size for this row.",
    category: "Execution & Sizing",
    applicability: "row",
    formatHint: "integer",
    guideCopy: {
      whatItIs: "Suggested quantity to purchase for the trade idea.",
      whyImportant: "Position sizing controls slippage, fill certainty, and capital lock-up.",
      goodValue: "Fits your risk budget while staying inside depth-supported execution.",
      ideaFlipHeuristic: "Use this as a starting point; trim size when depth or route risk worsens.",
    },
  },
  {
    key: "FilledQty",
    title: "Filled Qty",
    tooltip: "Estimated quantity expected to execute at modeled depth.",
    category: "Execution & Sizing",
    applicability: "row",
    formatHint: "integer",
    guideCopy: {
      whatItIs: "Projected quantity likely to fill based on visible depth assumptions.",
      whyImportant: "Realized profit depends on what can actually be filled, not headline size.",
      goodValue: "Close to Units to Buy with minimal shortfall.",
      ideaFlipHeuristic: "Large gaps vs Units to Buy signal thin books or over-sized positions.",
    },
  },
  {
    key: "CanFill",
    title: "Can Fill",
    tooltip: "Quick yes/no execution viability for modeled size.",
    category: "Execution & Sizing",
    applicability: "row",
    guideCopy: {
      whatItIs: "Indicator showing whether modeled quantity can be filled with current depth.",
      whyImportant: "Flags opportunities where paper profit is not practically executable.",
      goodValue: "True for your intended size most of the time.",
      ideaFlipHeuristic: "Treat false as a warning to resize or deprioritize.",
    },
  },
  {
    key: "BuyOrderRemain",
    title: "Accept Qty",
    tooltip: "Available destination bid-side quantity likely to absorb your unload.",
    category: "Execution & Sizing",
    applicability: "row",
    formatHint: "integer",
    guideCopy: {
      whatItIs: "Destination-side buy quantity available near expected sell execution.",
      whyImportant: "Low remaining bid depth can force worse exits.",
      goodValue: "Comfortably above your planned unload size.",
      ideaFlipHeuristic: "If this is tight, assume lower realized exits or split execution.",
    },
  },
  {
    key: "RealIskPerJump",
    title: "Real ISK/Jump",
    tooltip: "Realized profit estimate normalized by route jumps.",
    category: "Route Efficiency",
    applicability: "both",
    guideCopy: {
      whatItIs: "Realized profit estimate divided by max(1, total route jumps).",
      whyImportant: "Measures travel efficiency and opportunity cost of your pilot time.",
      goodValue: "Higher is better for active hauling; low values can still work if very safe and scalable.",
      ideaFlipHeuristic: "Use as the core sort metric when your bottleneck is movement time.",
    },
  },
  {
    key: "DailyIskPerJump",
    title: "Daily ISK/Jump",
    tooltip: "Repeatable daily earning power per jump.",
    category: "Route Efficiency",
    applicability: "both",
    guideCopy: {
      whatItIs: "Estimated daily profit potential normalized by route jumps.",
      whyImportant: "Balances route effort with repeatable daily earning power.",
      goodValue: "Consistently positive and materially above your fallback routes or station alternatives.",
      ideaFlipHeuristic: "Prefer steady mid-high daily ISK/jump over one-off spikes with weak flow support.",
    },
  },
  {
    key: "RealIskPerM3PerJump",
    title: "Real ISK/m³/j",
    tooltip: "Profit normalized by cargo volume and travel.",
    category: "Route Efficiency",
    applicability: "both",
    guideCopy: {
      whatItIs: "Real profit normalized by cargo volume and jump count.",
      whyImportant: "Shows how efficiently a route uses limited cargo space while traveling.",
      goodValue: "Higher is better; especially useful when hauling capacity is your constraint.",
      ideaFlipHeuristic: "Prioritize this when flying smaller hulls or when fuel/time per m³ matters.",
    },
  },
  {
    key: "TurnoverDays",
    title: "Turnover Days",
    tooltip: "Estimated days to recover committed capital.",
    category: "Risk & Resilience",
    applicability: "both",
    guideCopy: {
      whatItIs: "Approximate capital lock-up in days: capital required divided by daily profit.",
      whyImportant: "Long turnover ties up ISK and reduces compounding speed.",
      goodValue: "Commonly under 7-14 days for active strategies; over ~30 days is often too slow/risky.",
      ideaFlipHeuristic: "Use as a risk brake: reject great-looking spreads with very slow capital recovery.",
    },
  },
  {
    key: "SlippageCostIsk",
    title: "Slippage Cost",
    tooltip: "Estimated ISK lost to depth traversal on both sides.",
    category: "Risk & Resilience",
    applicability: "row",
    guideCopy: {
      whatItIs: "Estimated ISK lost to depth traversal on buy and sell execution at shown size.",
      whyImportant: "Directly eats realized profit and can invalidate tight-margin trades.",
      goodValue: "Low relative to Real Profit (ideally single-digit % of projected profit).",
      ideaFlipHeuristic: "If slippage cost is a large share of profit, cut size or skip.",
    },
  },
  {
    key: "ExecutionQuality",
    title: "Execution Quality",
    tooltip: "Composite 0-100 confidence that execution matches assumptions.",
    category: "Risk & Resilience",
    applicability: "both",
    guideCopy: {
      whatItIs: "Composite 0-100 score from fill ratio, slippage burden, depth support, and history/risk flags.",
      whyImportant: "Summarizes how likely the quoted trade is to execute close to expectations.",
      goodValue: "80-100 strong, 60-79 workable with caution, below 60 higher execution risk.",
      ideaFlipHeuristic: "Use as a sanity filter before committing significant capital or cargo space.",
    },
  },
  {
    key: "ExitOverhangDays",
    title: "Exit Overhang (days)",
    tooltip: "Estimated days for destination supply overhang to clear.",
    category: "Risk & Resilience",
    applicability: "row",
    guideCopy: {
      whatItIs: "Estimated days for destination demand to absorb visible target-side sell supply.",
      whyImportant: "High overhang suggests you may wait longer to exit at expected prices.",
      goodValue: "Lower is better; under ~3-7 days is usually healthier than double-digit overhang.",
      ideaFlipHeuristic: "Pair with S2B/day to avoid markets where supply wall can trap inventory.",
    },
  },
  {
    key: "BreakevenBuffer",
    title: "Breakeven Buffer %",
    tooltip: "Adverse move tolerance before expected profit reaches zero.",
    category: "Risk & Resilience",
    applicability: "both",
    guideCopy: {
      whatItIs: "Adverse move tolerance before expected profit drops to zero.",
      whyImportant: "Represents resilience to sudden price moves and fee/slippage surprises.",
      goodValue: "Higher is safer; <2-3% is fragile, 5%+ generally more robust.",
      ideaFlipHeuristic: "Treat low-buffer opportunities as short-horizon and size conservatively.",
    },
  },
  {
    key: "RouteSafety",
    title: "Route",
    tooltip: "Recent route danger signal based on gank activity.",
    category: "Risk & Resilience",
    applicability: "both",
    guideCopy: {
      whatItIs: "Recent route danger signal based on gank activity in the last hour.",
      whyImportant: "Transport losses can wipe out many successful flips.",
      goodValue: "Green/low-risk routes preferred; yellow/red requires stronger profit premium.",
      ideaFlipHeuristic: "Demand extra ISK/jump for risky pipes or avoid when hauling expensive cargo.",
    },
  },
  {
    key: "S2BPerDay",
    title: "S2B/Day",
    tooltip: "Estimated daily volume sold into destination buy orders.",
    category: "Flow & Liquidity",
    applicability: "row",
    guideCopy: {
      whatItIs: "Estimated daily volume sold into destination buy orders (sell-to-buy flow).",
      whyImportant: "Higher flow indicates faster potential exits and better liquidity.",
      goodValue: "Consistently above your planned daily unload size; very low values imply slow exits.",
      ideaFlipHeuristic: "Use minimum thresholds to avoid dead markets even when spreads look attractive.",
    },
  },
  {
    key: "BfSPerDay",
    title: "BfS/Day",
    tooltip: "Estimated daily source-side replenishment flow.",
    category: "Flow & Liquidity",
    applicability: "row",
    guideCopy: {
      whatItIs: "Estimated daily volume bought from source sell orders (buy-from-sell flow).",
      whyImportant: "Signals how naturally the source side replenishes at tradable prices.",
      goodValue: "Stable, non-trivial flow that supports your repeat buy cadence.",
      ideaFlipHeuristic: "Very weak BfS can mean stale pricing or brittle entry liquidity.",
    },
  },
  {
    key: "S2BBfSRatio",
    title: "S2B/BfS",
    tooltip: "Flow balance between exit and sourcing markets.",
    category: "Flow & Liquidity",
    applicability: "row",
    guideCopy: {
      whatItIs: "Flow balance ratio between destination exit flow and source entry flow.",
      whyImportant: "Helps detect one-sided markets where either sourcing or exiting dominates.",
      goodValue: "Around ~0.7-1.5 is often balanced; extreme values can indicate instability or data skew.",
      ideaFlipHeuristic: "Favor balanced ratios unless you intentionally trade niche imbalance opportunities.",
    },
  },
  {
    key: "UrgencyScore",
    title: "Urgency",
    tooltip: "Execution urgency score (0-100) from friction and risk signals.",
    category: "Prioritization",
    applicability: "row",
    guideCopy: {
      whatItIs: "Composite urgency score (0-100) derived from fill depth, slippage, jumps, and risk/staleness flags.",
      whyImportant: "Helps triage which opportunities should be executed first.",
      goodValue: "Higher values indicate faster-decaying edge and stronger priority.",
      ideaFlipHeuristic: "Sort by urgency when you have limited execution time or attention.",
    },
  },
  {
    key: "OpportunityScore",
    title: "Opportunity Score",
    tooltip: "Composite trade quality score for ranking opportunities.",
    category: "Prioritization",
    applicability: "both",
    guideCopy: {
      whatItIs: "Weighted composite score of route quality, profitability, liquidity, and execution risk.",
      whyImportant: "Provides a single comparable ranking across many rows/routes.",
      goodValue: "Higher relative to your benchmark opportunities in the same market context.",
      ideaFlipHeuristic: "Use as a first-pass ranker, then confirm with execution and risk metrics.",
    },
  },
  {
    key: "RoutePackTotalProfit",
    title: "Route Pack Total Profit",
    tooltip: "Combined realized profit estimate for all lines in a route pack.",
    category: "Route Pack Aggregates",
    applicability: "route",
    guideCopy: {
      whatItIs: "Sum of projected real profit across selected route-pack lines.",
      whyImportant: "Shows total ISK impact of executing the full route pack.",
      goodValue: "Strongly positive and resilient after slippage/risk checks.",
      ideaFlipHeuristic: "Use with per-jump and risk metrics to avoid chasing raw total only.",
    },
  },
  {
    key: "RoutePackRealIskPerJump",
    title: "Route Pack Real ISK/Jump",
    tooltip: "Route-pack level travel efficiency.",
    category: "Route Pack Aggregates",
    applicability: "route",
    guideCopy: {
      whatItIs: "Aggregate route-pack realized profit divided by total jumps.",
      whyImportant: "Normalizes pack value for travel effort.",
      goodValue: "Higher than your alternative route packs for similar risk.",
      ideaFlipHeuristic: "Prioritize this when flight time is your hard constraint.",
    },
  },
  {
    key: "RoutePackWeakestExecutionQuality",
    title: "Route Pack Weakest Execution Quality",
    tooltip: "Lowest execution-quality score among lines in the pack.",
    category: "Route Pack Aggregates",
    applicability: "route",
    guideCopy: {
      whatItIs: "Worst execution-quality value observed among route-pack lines.",
      whyImportant: "A single weak leg can drag down realized pack outcomes.",
      goodValue: "Keeps above your minimum safety threshold (e.g., 60+).",
      ideaFlipHeuristic: "Treat this as a guardrail before committing to a large multi-line route.",
    },
  },
  {
    key: "RoutePackTurnoverDays",
    title: "Route Pack Turnover Days",
    tooltip: "Estimated pack-level capital recovery time.",
    category: "Route Pack Aggregates",
    applicability: "route",
    guideCopy: {
      whatItIs: "Route-pack capital lock-up days using aggregate daily profitability.",
      whyImportant: "Prevents overcommitting capital to slow-recovering packs.",
      goodValue: "Comparable to or better than your row-level turnover targets.",
      ideaFlipHeuristic: "Deprioritize packs with excellent totals but very slow capital recycling.",
    },
  },
  {
    key: "RoutePackBreakevenBuffer",
    title: "Route Pack Breakeven Buffer",
    tooltip: "Pack-level tolerance to adverse repricing before profits vanish.",
    category: "Route Pack Aggregates",
    applicability: "route",
    guideCopy: {
      whatItIs: "Aggregate adverse-move tolerance before expected route-pack profit reaches zero.",
      whyImportant: "Captures resilience of the full pack against market moves.",
      goodValue: "Higher buffer indicates safer aggregate execution.",
      ideaFlipHeuristic: "Use as a final sanity check before hauling high-value route packs.",
    },
  },
];

export const radiusColumnRegistryByKey: Record<string, RadiusColumnRegistryEntry> =
  Object.fromEntries(radiusColumnRegistry.map((entry) => [entry.key, entry]));

export function getRadiusColumnMeta(key: string): RadiusColumnRegistryEntry | undefined {
  return radiusColumnRegistryByKey[key];
}

export function assertKnownRadiusColumnKeys(keys: readonly string[], context = "unknown"): void {
  const unknown = keys.filter((key) => !radiusColumnRegistryByKey[key]);
  if (unknown.length > 0) {
    throw new Error(
      `[radiusColumnRegistry] ${context} references unknown keys: ${unknown.join(", ")}`,
    );
  }
}

export function findMissingRadiusGuideEntries(tableKeys: readonly string[]): string[] {
  return tableKeys.filter((key) => !radiusColumnRegistryByKey[key]);
}
