import { useMemo, useState } from "react";
import { parseClipboardSellList } from "@/lib/clipboardSellList";
import {
  evaluateInventorySell,
  formatSellPlanText,
  type InventorySellEvaluationResult,
} from "@/lib/inventorySellEvaluator";
import type { FlipResult } from "@/lib/types";

type Props = {
  rows: FlipResult[];
};

export function SellClipboardPanel({ rows }: Props) {
  const [text, setText] = useState("");
  const [compareJita, setCompareJita] = useState(true);
  const [sellNow] = useState(true);
  const [result, setResult] = useState<InventorySellEvaluationResult | null>(null);

  const parsed = useMemo(
    () => parseClipboardSellList(text, { mergeDuplicates: true }),
    [text],
  );

  const onEvaluate = () => {
    setResult(
      evaluateInventorySell(parsed.items, rows, {
        compareJita,
        requireDepthCoverage: sellNow,
      }),
    );
  };

  return (
    <div className="p-3 text-sm space-y-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-36 bg-eve-input border border-eve-border p-2" placeholder="Name<TAB>Qty" />
      <div className="flex gap-3">
        <label><input type="checkbox" checked={sellNow} readOnly /> Sell Now</label>
        <label><input type="checkbox" checked={compareJita} onChange={(e) => setCompareJita(e.target.checked)} /> Jita Benchmark</label>
      </div>
      <div className="flex gap-2">
        <button className="px-2 py-1 border" onClick={onEvaluate}>Evaluate</button>
        <button className="px-2 py-1 border" onClick={() => { setText(""); setResult(null); }}>Clear</button>
        <button className="px-2 py-1 border" onClick={() => void navigator.clipboard.writeText(formatSellPlanText(result ?? { items: [], summaries: [], unresolvedItems: [] }))}>Copy Sell Plan</button>
      </div>
      {parsed.errors.length > 0 && (
        <div className="text-eve-error text-xs">
          {parsed.errors.map((error) => (
            <div key={`${error.lineNumber}-${error.rawLine}`}>Line {error.lineNumber}: {error.message}</div>
          ))}
        </div>
      )}
      {result && (
        <>
          <table className="w-full text-xs">
            <thead><tr><th>Station</th><th>System</th><th>Total</th><th>Jumps</th><th>ISK/Jump</th></tr></thead>
            <tbody>{result.summaries.map((s) => <tr key={s.locationKey}><td>{s.stationName}</td><td>{s.systemName}</td><td>{Math.round(s.totalGrossSellIsk)}</td><td>{s.jumps ?? "-"}</td><td>{Math.round(s.avgIskPerJump ?? 0)}</td></tr>)}</tbody>
          </table>
          <table className="w-full text-xs">
            <thead><tr><th>Item</th><th>Qty</th><th>Best Bid</th><th>Gross</th><th>Depth%</th><th>Confidence</th></tr></thead>
            <tbody>{result.items.map((item) => <tr key={`${item.item.lineNumber}-${item.item.name}`}><td>{item.item.originalName}</td><td>{item.item.quantity}</td><td>{item.best?.bidPrice ?? 0}</td><td>{Math.round(item.grossSellIsk)}</td><td>{item.depthCoveragePct.toFixed(1)}</td><td>{item.confidence}</td></tr>)}</tbody>
          </table>
          {result.unresolvedItems.length > 0 && <div className="text-xs text-eve-dim">Unresolved: {result.unresolvedItems.map((i) => i.originalName).join(", ")}</div>}
        </>
      )}
    </div>
  );
}
