import type { RadiusBuyStationShoppingList } from "@/lib/radiusBuyStationShoppingList";
import type { RadiusDealMovement } from "@/lib/radiusDealMovement";
import { RadiusDealMovementBadge } from "@/components/RadiusDealMovementBadge";
import { formatIskLabel, formatIskPerJumpLabel, formatRiskLabel } from "@/lib/radiusDecisionGuardrails";

type Props = {
  lists: RadiusBuyStationShoppingList[];
  onOpenRows: (stationGroupId: number) => void;
  onCopyBuyChecklist: (list: RadiusBuyStationShoppingList) => void;
  onCopySellChecklist: (list: RadiusBuyStationShoppingList) => void;
  onCopyManifest: (list: RadiusBuyStationShoppingList) => void;
  onOpenBatch: (list: RadiusBuyStationShoppingList) => void;
  onVerifyStationGroup: (list: RadiusBuyStationShoppingList) => void;
  movementByListId?: Record<string, RadiusDealMovement>;
};

export function RadiusBuyStationShoppingListView({ lists, movementByListId = {}, ...actions }: Props) {
  return (
    <div className="grid gap-2" data-testid="radius-buy-station-shopping-list">
      {lists.map((list) => (
        <div key={list.id} className="rounded-sm border border-eve-border/60 bg-eve-dark/30 p-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-eve-text">{list.buyStationName}</div>
              <div className="text-[11px] text-eve-dim">
                {list.buySystemName} • Best sell: <span className="text-eve-text">{list.primarySellStation}</span>
              </div>
            </div>
            <div className="flex items-center gap-1"><RadiusDealMovementBadge movement={movementByListId[list.id]} /><div className="text-eve-accent font-mono">Score {list.actionableScore.toFixed(1)}</div></div>
          </div>

          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-eve-dim">
            <span>Profit {formatIskLabel(list.totalProfitIsk)}</span>
            <span>Capital {formatIskLabel(list.capitalIsk)}</span>
            <span>Fill {list.cargoFillPercent.toFixed(1)}%</span>
            <span>ISK/jump {formatIskPerJumpLabel(list.bestIskPerJump)}</span>
            <span>Exec {list.avgExecutionQuality.toFixed(0)}%</span>
            <span>Confidence {list.confidence.toFixed(0)}%</span>
            <span>{formatRiskLabel(list.worstTrapRisk)}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
            <button type="button" onClick={() => actions.onOpenRows(list.buyGroupId)} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text">Open rows</button>
            <button type="button" onClick={() => actions.onCopyBuyChecklist(list)} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text">Copy buy checklist</button>
            <button type="button" onClick={() => actions.onCopySellChecklist(list)} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text">Copy sell checklist</button>
            <button type="button" onClick={() => actions.onCopyManifest(list)} className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 text-eve-dim hover:text-eve-text">Copy full manifest</button>
            <button type="button" onClick={() => actions.onOpenBatch(list)} className="rounded-sm border border-eve-accent/60 px-1.5 py-0.5 text-eve-accent">Open batch</button>
            <button type="button" onClick={() => actions.onVerifyStationGroup(list)} className="rounded-sm border border-amber-400/60 px-1.5 py-0.5 text-amber-200">Verify station group</button>
          </div>
        </div>
      ))}
    </div>
  );
}
