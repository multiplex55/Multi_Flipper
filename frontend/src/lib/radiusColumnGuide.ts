export type RadiusColumnGuideRow = {
  columnKey: string;
  title: string;
  whatItIs: string;
  whyImportant: string;
  goodValue: string;
  ideaFlipHeuristic: string;
};

export const radiusColumnGuideRows: RadiusColumnGuideRow[] = [
  {
    columnKey: "BuyPrice",
    title: "Best Ask (L1)",
    whatItIs: "The cheapest current sell order in the buy market (top of book).",
    whyImportant: "This anchors your entry price and defines how quickly you can acquire inventory.",
    goodValue: "Lower relative to target-side sell prices and close to historical average (not a temporary spike).",
    ideaFlipHeuristic: "Prefer stable asks with enough L1 depth to fill most of your planned size without chasing up.",
  },
  {
    columnKey: "BestAskQty",
    title: "L1 Ask Qty",
    whatItIs: "Units available at the single best ask price right now.",
    whyImportant: "Low L1 depth means your real fill price may be worse than the headline ask.",
    goodValue: "Enough to fill at least 50-100% of your intended quantity at the top level.",
    ideaFlipHeuristic: "If L1 quantity is thin, reduce size or use expected fill metrics over top-book metrics.",
  },
  {
    columnKey: "ExpectedBuyPrice",
    title: "Avg Buy Fill",
    whatItIs: "Estimated average purchase price after considering order-book depth for your shown size.",
    whyImportant: "This is more realistic than Best Ask for medium/large fills.",
    goodValue: "Close to Best Ask (small spread impact), typically under 1-2% slippage for liquid items.",
    ideaFlipHeuristic: "Large gap vs Best Ask usually means hidden slippage risk; size down or skip.",
  },
  {
    columnKey: "SellPrice",
    title: "Best Bid (L1)",
    whatItIs: "Highest current buy order in the destination market (top of book).",
    whyImportant: "Defines immediate exit value and top-book profit potential.",
    goodValue: "Comfortably above expected buy fill plus fees, with consistent demand behind it.",
    ideaFlipHeuristic: "Treat isolated high bids cautiously unless depth and flow confirm they are real liquidity.",
  },
  {
    columnKey: "BestBidQty",
    title: "L1 Bid Qty",
    whatItIs: "Units currently bid at the best bid price level.",
    whyImportant: "Small bid size can vanish quickly and force sales into worse prices.",
    goodValue: "Can absorb a meaningful share of your planned sell size without stepping down levels.",
    ideaFlipHeuristic: "If bid depth is thin, assume lower realized exits and focus on Daily Profit quality metrics.",
  },
  {
    columnKey: "ExpectedSellPrice",
    title: "Avg Sell Fill",
    whatItIs: "Estimated average sale price after considering bid-side depth at your selected quantity.",
    whyImportant: "This captures likely liquidation reality, not best-case top-book exits.",
    goodValue: "Close to Best Bid with limited depth erosion; persistent gaps indicate fragile demand.",
    ideaFlipHeuristic: "Use this with Avg Buy Fill for sizing; avoid trades where both sides degrade heavily.",
  },
  {
    columnKey: "MarginPercent",
    title: "Margin %",
    whatItIs: "Gross percentage spread between buy and sell sides before or around fee assumptions.",
    whyImportant: "Higher margin gives buffer against fees, slippage, and short-term price moves.",
    goodValue: "Often 8-15%+ for safer flips; under ~5% is usually fragile unless turnover is exceptional.",
    ideaFlipHeuristic: "Combine margin with execution quality; high margin alone can be a trap in thin books.",
  },
  {
    columnKey: "RealIskPerJump",
    title: "Real ISK/Jump",
    whatItIs: "Realized profit estimate divided by max(1, total route jumps).",
    whyImportant: "Measures travel efficiency and opportunity cost of your pilot time.",
    goodValue: "Higher is better for active hauling; low values can still work if very safe and scalable.",
    ideaFlipHeuristic: "Use as the core sort metric when your bottleneck is movement time.",
  },
  {
    columnKey: "DailyIskPerJump",
    title: "Daily ISK/Jump",
    whatItIs: "Estimated daily profit potential normalized by route jumps.",
    whyImportant: "Balances route effort with repeatable daily earning power.",
    goodValue: "Consistently positive and materially above your fallback routes or station alternatives.",
    ideaFlipHeuristic: "Prefer steady mid-high daily ISK/jump over one-off spikes with weak flow support.",
  },
  {
    columnKey: "RealIskPerM3PerJump",
    title: "Real ISK/m³/j",
    whatItIs: "Real profit normalized by cargo volume and jump count.",
    whyImportant: "Shows how efficiently a route uses limited cargo space while traveling.",
    goodValue: "Higher is better; especially useful when hauling capacity is your constraint.",
    ideaFlipHeuristic: "Prioritize this when flying smaller hulls or when fuel/time per m³ matters.",
  },
  {
    columnKey: "TurnoverDays",
    title: "Turnover Days",
    whatItIs: "Approximate capital lock-up in days: capital required divided by daily profit.",
    whyImportant: "Long turnover ties up ISK and reduces compounding speed.",
    goodValue: "Commonly under 7-14 days for active strategies; over ~30 days is often too slow/risky.",
    ideaFlipHeuristic: "Use as a risk brake: reject great-looking spreads with very slow capital recovery.",
  },
  {
    columnKey: "SlippageCostIsk",
    title: "Slippage Cost",
    whatItIs: "Estimated ISK lost to depth traversal on buy and sell execution at shown size.",
    whyImportant: "Directly eats realized profit and can invalidate tight-margin trades.",
    goodValue: "Low relative to Real Profit (ideally single-digit % of projected profit).",
    ideaFlipHeuristic: "If slippage cost is a large share of profit, cut size or skip.",
  },
  {
    columnKey: "ExecutionQuality",
    title: "Execution Quality",
    whatItIs: "Composite 0-100 score from fill ratio, slippage burden, depth support, and history/risk flags.",
    whyImportant: "Summarizes how likely the quoted trade is to execute close to expectations.",
    goodValue: "80-100 strong, 60-79 workable with caution, below 60 higher execution risk.",
    ideaFlipHeuristic: "Use as a sanity filter before committing significant capital or cargo space.",
  },
  {
    columnKey: "ExitOverhangDays",
    title: "Exit Overhang (days)",
    whatItIs: "Estimated days for destination demand to absorb visible target-side sell supply.",
    whyImportant: "High overhang suggests you may wait longer to exit at expected prices.",
    goodValue: "Lower is better; under ~3-7 days is usually healthier than double-digit overhang.",
    ideaFlipHeuristic: "Pair with S2B/day to avoid markets where supply wall can trap inventory.",
  },
  {
    columnKey: "BreakevenBuffer",
    title: "Breakeven Buffer %",
    whatItIs: "Adverse move tolerance before expected profit drops to zero.",
    whyImportant: "Represents resilience to sudden price moves and fee/slippage surprises.",
    goodValue: "Higher is safer; <2-3% is fragile, 5%+ generally more robust.",
    ideaFlipHeuristic: "Treat low-buffer opportunities as short-horizon and size conservatively.",
  },
  {
    columnKey: "RouteSafety",
    title: "Route",
    whatItIs: "Recent route danger signal based on gank activity in the last hour.",
    whyImportant: "Transport losses can wipe out many successful flips.",
    goodValue: "Green/low-risk routes preferred; yellow/red requires stronger profit premium.",
    ideaFlipHeuristic: "Demand extra ISK/jump for risky pipes or avoid when hauling expensive cargo.",
  },
  {
    columnKey: "S2BPerDay",
    title: "S2B/Day",
    whatItIs: "Estimated daily volume sold into destination buy orders (sell-to-buy flow).",
    whyImportant: "Higher flow indicates faster potential exits and better liquidity.",
    goodValue: "Consistently above your planned daily unload size; very low values imply slow exits.",
    ideaFlipHeuristic: "Use minimum thresholds to avoid dead markets even when spreads look attractive.",
  },
  {
    columnKey: "BfSPerDay",
    title: "BfS/Day",
    whatItIs: "Estimated daily volume bought from source sell orders (buy-from-sell flow).",
    whyImportant: "Signals how naturally the source side replenishes at tradable prices.",
    goodValue: "Stable, non-trivial flow that supports your repeat buy cadence.",
    ideaFlipHeuristic: "Very weak BfS can mean stale pricing or brittle entry liquidity.",
  },
  {
    columnKey: "S2BBfSRatio",
    title: "S2B/BfS",
    whatItIs: "Flow balance ratio between destination exit flow and source entry flow.",
    whyImportant: "Helps detect one-sided markets where either sourcing or exiting dominates.",
    goodValue: "Around ~0.7-1.5 is often balanced; extreme values can indicate instability or data skew.",
    ideaFlipHeuristic: "Favor balanced ratios unless you intentionally trade niche imbalance opportunities.",
  },
];

export const radiusColumnHintTextByKey: Record<string, string> = Object.fromEntries(
  radiusColumnGuideRows.map((row) => [
    row.columnKey,
    `${row.whatItIs} Why it matters: ${row.whyImportant} Good vs risky: ${row.goodValue}`,
  ]),
);
