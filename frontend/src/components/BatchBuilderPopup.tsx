import { useCallback, useEffect, useMemo, useState } from "react";
import { formatISK } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  buildBatch,
  routeLineKey,
  safeNumber,
  type BatchBuildResult,
} from "@/lib/batchMetrics";
import { formatBatchLinesToMultibuyLines } from "@/lib/batchManifestFormat";
import type { FlipResult } from "@/lib/types";
import { Modal } from "./Modal";
import { useGlobalToast } from "./Toast";

interface BatchBuilderPopupProps {
  open: boolean;
  onClose: () => void;
  anchorRow: FlipResult | null;
  rows: FlipResult[];
  defaultCargoM3?: number;
}

export function BatchBuilderPopup({
  open,
  onClose,
  anchorRow,
  rows,
  defaultCargoM3 = 0,
}: BatchBuilderPopupProps) {
  const { t } = useI18n();
  const { addToast } = useGlobalToast();
  const [cargoLimitM3, setCargoLimitM3] = useState<number>(
    defaultCargoM3 > 0 ? defaultCargoM3 : 0,
  );

  useEffect(() => {
    if (!open) return;
    setCargoLimitM3(defaultCargoM3 > 0 ? defaultCargoM3 : 0);
  }, [open, defaultCargoM3]);

  const batch = useMemo(() => {
    if (!anchorRow) {
      const emptyBatch: BatchBuildResult = {
        lines: [],
        totalVolume: 0,
        totalProfit: 0,
        totalCapital: 0,
        totalGrossSell: 0,
        remainingM3: cargoLimitM3 > 0 ? cargoLimitM3 : null,
        usedPercent: cargoLimitM3 > 0 ? 0 : null,
      };
      return emptyBatch;
    }
    return buildBatch(anchorRow, rows, cargoLimitM3);
  }, [anchorRow, rows, cargoLimitM3]);

  const copyManifest = useCallback(async () => {
    if (!anchorRow || batch.lines.length === 0) return;
    const lines: string[] = [];
    const multibuyLines = formatBatchLinesToMultibuyLines(batch.lines);
    const buyJumps = Math.max(0, Math.floor(safeNumber(anchorRow.BuyJumps)));
    const sellJumps = Math.max(0, Math.floor(safeNumber(anchorRow.SellJumps)));
    const totalRouteJumps = buyJumps + sellJumps;
    const totalIskPerJump = totalRouteJumps > 0 ? batch.totalProfit / totalRouteJumps : 0;
    lines.push(`Buy Station: ${anchorRow.BuyStation}`);
    lines.push(`Jumps to Buy Station: ${buyJumps}`);
    lines.push(`Sell Station: ${anchorRow.SellStation}`);
    lines.push(`Jumps Buy -> Sell: ${sellJumps}`);
    lines.push(
      `Cargo m3: ${
        cargoLimitM3 > 0 ? cargoLimitM3.toLocaleString() : t("batchBuilderCargoUnlimited")
      }`,
    );
    lines.push(`Items: ${batch.lines.length}`);
    lines.push(`Total volume: ${batch.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} m3`);
    lines.push(`Total capital: ${Math.round(batch.totalCapital).toLocaleString()} ISK`);
    lines.push(`Total gross sell: ${Math.round(batch.totalGrossSell).toLocaleString()} ISK`);
    lines.push(`Total profit: ${Math.round(batch.totalProfit).toLocaleString()} ISK`);
    lines.push(`Total isk/jump: ${Math.round(totalIskPerJump).toLocaleString()} ISK`);
    lines.push("");
    for (const line of batch.lines) {
      const buyPrice = line.capital / line.units;
      const sellPrice = line.grossSell / line.units;
      lines.push(
        `${line.row.TypeName} | qty ${line.units.toLocaleString()} | buy ${Math.round(buyPrice).toLocaleString()} ISK | sell ${Math.round(sellPrice).toLocaleString()} ISK | vol ${line.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })} m3 | profit ${Math.round(line.profit).toLocaleString()} ISK`,
      );
    }
    lines.push("");
    lines.push(...multibuyLines);
    await navigator.clipboard.writeText(lines.join("\n"));
    addToast(t("batchBuilderCopied"), "success", 2200);
  }, [anchorRow, batch, cargoLimitM3, t, addToast]);

  if (!anchorRow) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t("batchBuilderTitle")}: ${anchorRow.BuyStation} -> ${anchorRow.SellStation}`}
      width="max-w-5xl"
    >
      <div className="p-4 flex flex-col gap-3">
        <p className="text-xs text-eve-dim">{t("batchBuilderHint")}</p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-eve-dim">
            <span>{t("batchBuilderCargoLabel")}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={cargoLimitM3}
              onChange={(e) =>
                setCargoLimitM3(Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0))
              }
              className="w-36 px-2 py-1 bg-eve-input border border-eve-border rounded-sm text-eve-text font-mono text-sm"
            />
            <span className="text-[10px] text-eve-dim/80">{t("batchBuilderCargoHint")}</span>
          </label>

          <button
            type="button"
            onClick={() => {
              void copyManifest();
            }}
            disabled={batch.lines.length === 0}
            className="px-3 py-1.5 rounded-sm border border-eve-accent/70 text-eve-accent hover:bg-eve-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider"
          >
            {t("batchBuilderCopyManifest")}
          </button>
        </div>

        {batch.lines.length === 0 ? (
          <div className="border border-eve-border rounded-sm p-3 text-sm text-eve-dim">
            {t("batchBuilderNoCandidates")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">{t("batchBuilderTotalVolume")}</div>
                <div className="text-eve-accent font-mono mt-0.5">
                  {batch.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} m3
                </div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">{t("batchBuilderTotalProfit")}</div>
                <div className="text-green-400 font-mono mt-0.5">{formatISK(batch.totalProfit)}</div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">{t("batchBuilderTotalCapital")}</div>
                <div className="text-eve-text font-mono mt-0.5">{formatISK(batch.totalCapital)}</div>
              </div>
              <div className="border border-eve-border rounded-sm p-2 bg-eve-panel">
                <div className="text-eve-dim">{t("batchBuilderCargoUsage")}</div>
                <div className="text-yellow-300 font-mono mt-0.5">
                  {batch.usedPercent != null
                    ? `${batch.usedPercent.toFixed(1)}%`
                    : t("batchBuilderCargoUnlimited")}
                </div>
                {batch.remainingM3 != null && (
                  <div className="text-[11px] text-eve-dim mt-0.5">
                    {t("batchBuilderCargoRemaining")}:{" "}
                    {batch.remainingM3.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                    m3
                  </div>
                )}
              </div>
            </div>

            <div className="border border-eve-border rounded-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-eve-panel border-b border-eve-border text-eve-dim uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-2 py-1.5">{t("batchBuilderColItem")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColQty")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColVolume")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColCapital")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColProfit")}</th>
                    <th className="text-right px-2 py-1.5">{t("batchBuilderColDensity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.lines.map((line) => (
                    <tr
                      key={routeLineKey(line.row)}
                      className="border-b border-eve-border/50 last:border-b-0"
                    >
                      <td className="px-2 py-1.5 text-eve-text">{line.row.TypeName}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-text">
                        {line.units.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-dim">
                        {line.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-eve-dim">
                        {formatISK(line.capital)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-green-400">
                        {formatISK(line.profit)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-yellow-300">
                        {formatISK(line.iskPerM3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
