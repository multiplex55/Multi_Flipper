import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  compareManifestToExport,
  type ComparisonRow,
  type ComparisonOptions,
  type ComparisonResult,
} from "@/features/batchVerifier/compare";
import {
  formatDoNotBuyList,
  formatSummaryReport,
  formatSummaryTotal,
  getVerdictPresentation,
} from "@/features/batchVerifier/formatting";
import {
  parseBatchManifest,
  parseExportOrder,
  type ParseDiagnostic,
} from "@/features/batchVerifier/parsing";

type EvaluationResult = {
  buyThese: ComparisonRow[];
  doNotBuyThese: ComparisonRow[];
  missing: ComparisonRow[];
  unexpected: ComparisonRow[];
  diagnostics: ParseDiagnostic[];
  modeLabel: string;
  comparison: ComparisonResult;
};

type ToleranceMode = "strict" | "allow_slippage" | "sell_value_evaluate";
type SlippageType = "isk" | "percent";
type QuantityHandling = "ignore_mismatch" | "require_exact";

const statusStyles: Record<string, CSSProperties> = {
  safe: { backgroundColor: "#052e16", color: "#bbf7d0" },
  do_not_buy: { backgroundColor: "#450a0a", color: "#fecaca" },
  quantity_mismatch: { backgroundColor: "#422006", color: "#fde68a" },
  missing_from_export: { backgroundColor: "#1f2937", color: "#e5e7eb" },
  unexpected_in_export: { backgroundColor: "#0f172a", color: "#cbd5e1" },
};

const tableHeaderCellStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #4b5563",
  backgroundColor: "#111827",
  color: "#e5e7eb",
  fontWeight: 600,
};

const tableBodyCellStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #374151",
};

const sectionStyle: CSSProperties = { border: "1px solid #374151", borderRadius: 8, padding: 12 };

const themedInputClassName =
  "w-full rounded-sm border border-eve-border bg-eve-input px-3 py-2 text-sm text-eve-text placeholder:text-eve-dim focus:outline-none focus:border-eve-accent focus:ring-1 focus:ring-eve-accent/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:text-eve-dim";


function formatNumber(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function decisionForRow(state: ComparisonRow["state"]): string {
  if (state === "safe") return "Buy";
  if (state === "quantity_mismatch") return "Review";
  if (state === "do_not_buy") return "Do not buy";
  if (state === "missing_from_export") return "Missing";
  return "Unexpected";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function ResultTable({ rows }: { rows: ComparisonRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        data-testid="batch-verifier-result-table"
        style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, backgroundColor: "#0b1220", color: "#e5e7eb" }}
      >
        <thead>
          <tr>
            <th style={tableHeaderCellStyle}>Item name</th>
            <th style={tableHeaderCellStyle}>Manifest qty</th>
            <th style={tableHeaderCellStyle}>Export qty</th>
            <th style={tableHeaderCellStyle}>Target buy per</th>
            <th style={tableHeaderCellStyle}>Actual buy per</th>
            <th style={tableHeaderCellStyle}>Delta</th>
            <th style={tableHeaderCellStyle}>Decision</th>
            <th style={tableHeaderCellStyle}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.name}-${row.state}-${index}`}
              data-testid={`result-row-${row.state}`}
              data-row-state={row.state}
              style={statusStyles[row.state]}
            >
              <td style={tableBodyCellStyle}>{row.name}</td>
              <td style={tableBodyCellStyle}>{formatNumber(row.manifestItem?.qty)}</td>
              <td style={tableBodyCellStyle}>{formatNumber(row.exportItem?.qty)}</td>
              <td style={tableBodyCellStyle}>{formatNumber(row.manifestItem?.buyPer)}</td>
              <td style={tableBodyCellStyle}>{formatNumber(row.exportItem?.buyPer)}</td>
              <td style={tableBodyCellStyle}>{formatNumber(row.buyPerDelta)}</td>
              <td style={tableBodyCellStyle}>{decisionForRow(row.state)}</td>
              <td style={tableBodyCellStyle}>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultSection({ title, rows }: { title: string; rows: ComparisonRow[] }) {
  return (
    <section aria-label={title} data-testid={`result-section-${title}`} style={sectionStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {rows.length === 0 ? <p>No items.</p> : <ResultTable rows={rows} />}
    </section>
  );
}

function ParseDiagnostics({ diagnostics }: { diagnostics: ParseDiagnostic[] }) {
  if (diagnostics.length === 0) return null;

  return (
    <section
      aria-label="Parse diagnostics"
      data-testid="parse-diagnostics-section"
      style={{ border: "1px solid #92400e", borderRadius: 8, padding: 12, backgroundColor: "#1f1606", color: "#fde68a" }}
    >
      <h3 style={{ marginTop: 0 }}>Parse diagnostics</h3>
      <ul>
        {diagnostics.map((diagnostic) => (
          <li key={`${diagnostic.lineNumber}-${diagnostic.reason}-${diagnostic.line}`}>
            Line {diagnostic.lineNumber}: {diagnostic.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}

type BatchBuyVerifierProps = {
  initialManifestText?: string;
};

export function BatchBuyVerifier({ initialManifestText }: BatchBuyVerifierProps) {
  const [manifestText, setManifestText] = useState("");
  const [exportText, setExportText] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [toleranceMode, setToleranceMode] = useState<ToleranceMode>("sell_value_evaluate");
  const [slippageType, setSlippageType] = useState<SlippageType>("isk");
  const [slippageValueInput, setSlippageValueInput] = useState<string>("0");
  const [priceDiffAlertPercentInput, setPriceDiffAlertPercentInput] = useState<string>("10");
  const [quantityHandling, setQuantityHandling] = useState<QuantityHandling>("require_exact");

  useEffect(() => {
    if (initialManifestText == null) return;
    setManifestText(initialManifestText);
    setExportText("");
    setResult(null);
    setCopyStatus("");
  }, [initialManifestText]);

  const hasInput = manifestText.trim().length > 0 || exportText.trim().length > 0;

  const summaryText = useMemo(
    () => (result ? formatSummaryReport(result.comparison, { modeLabel: result.modeLabel }) : ""),
    [result],
  );
  const doNotBuyText = useMemo(() => (result ? formatDoNotBuyList(result.comparison) : ""), [result]);
  const doNotBuyLinesText = useMemo(() => {
    if (!result) return "";
    const blocked = result.comparison.rows.filter((row) => row.state === "do_not_buy");
    if (blocked.length === 0) return "No do-not-buy lines.";
    return blocked.map((row) => `${row.name} — ${row.reason}`).join("\n");
  }, [result]);
  const changedLinesText = useMemo(() => {
    if (!result) return "";
    const changed = result.comparison.rows.filter(
      (row) =>
        row.state !== "safe" ||
        (typeof row.buyPerDelta === "number" && row.buyPerDelta !== 0) ||
        (typeof row.qtyDelta === "number" && row.qtyDelta !== 0),
    );
    if (changed.length === 0) return "No changed lines.";
    return changed.map((row) => `${row.name} — ${row.reason}`).join("\n");
  }, [result]);

  const slippageValue = useMemo(() => {
    if (slippageValueInput.trim() === "") return Number.NaN;
    return Number(slippageValueInput);
  }, [slippageValueInput]);

  const slippageValidationMessage = useMemo(() => {
    if (toleranceMode === "strict" || toleranceMode === "sell_value_evaluate") return "";
    if (!Number.isFinite(slippageValue)) return "Slippage value must be a valid number.";
    if (slippageValue < 0) return "Slippage value must be non-negative.";
    if (slippageType === "percent" && slippageValue > 100) return "Percent slippage must be between 0 and 100.";
    return "";
  }, [slippageType, slippageValue, toleranceMode]);

  const priceDiffAlertPercent = useMemo(() => {
    if (priceDiffAlertPercentInput.trim() === "") return Number.NaN;
    return Number(priceDiffAlertPercentInput);
  }, [priceDiffAlertPercentInput]);

  const priceDiffValidationMessage = useMemo(() => {
    if (!Number.isFinite(priceDiffAlertPercent)) return "Price diff alert % must be a valid number.";
    if (priceDiffAlertPercent < 0) return "Price diff alert % must be non-negative.";
    return "";
  }, [priceDiffAlertPercent]);

  const optionsForCompare = useMemo<ComparisonOptions>(() => {
    const base: ComparisonOptions = {
      includeReview: true,
      enableQuantityMismatch: quantityHandling === "require_exact",
      priceDiffAlertPercent: Number.isFinite(priceDiffAlertPercent) ? priceDiffAlertPercent : undefined,
    };

    if (toleranceMode === "strict") {
      return {
        ...base,
        thresholdMode: "strict",
      };
    }

    if (toleranceMode === "sell_value_evaluate") {
      return {
        ...base,
        thresholdMode: "sell_value_evaluate",
      };
    }

    if (slippageType === "isk") {
      return {
        ...base,
        thresholdMode: "isk_tolerance",
        iskTolerance: Number.isFinite(slippageValue) ? slippageValue : 0,
      };
    }

    return {
      ...base,
      thresholdMode: "percent_tolerance",
      percentTolerance: Number.isFinite(slippageValue) ? slippageValue : 0,
    };
  }, [priceDiffAlertPercent, quantityHandling, slippageType, slippageValue, toleranceMode]);

  const modeSummaryLabel = useMemo(() => {
    const quantityLabel = quantityHandling === "require_exact" ? "quantity exact" : "ignore quantity mismatch";
    if (toleranceMode === "strict") return `Strict, ${quantityLabel}`;
    if (toleranceMode === "sell_value_evaluate") return `Sell Value Evaluate, ${quantityLabel}`;
    const toleranceLabel = slippageType === "isk" ? `${slippageValueInput} ISK` : `${slippageValueInput}%`;
    return `Allow slippage (${toleranceLabel}), ${quantityLabel}`;
  }, [quantityHandling, slippageType, slippageValueInput, toleranceMode]);

  const handleEvaluate = () => {
    if (slippageValidationMessage || priceDiffValidationMessage) return;
    const manifestParsed = parseBatchManifest(manifestText);
    const exportParsed = parseExportOrder(exportText);
    const comparison = compareManifestToExport(manifestParsed.items, exportParsed.items, optionsForCompare);

    setResult({
      buyThese: comparison.buyThese,
      doNotBuyThese: [...comparison.doNotBuy, ...(comparison.review ?? [])],
      missing: comparison.missing,
      unexpected: comparison.unexpected,
      diagnostics: [...manifestParsed.errors, ...exportParsed.errors],
      modeLabel: modeSummaryLabel,
      comparison,
    });
    setCopyStatus("");
  };

  const handleClear = () => {
    setManifestText("");
    setExportText("");
    setResult(null);
    setCopyStatus("");
  };

  const handleCopySummary = async () => {
    if (!result) return;
    const ok = await copyToClipboard(summaryText);
    setCopyStatus(ok ? "Summary copied." : "Copy failed.");
  };

  const handleCopyDoNotBuy = async () => {
    if (!result) return;
    const ok = await copyToClipboard(doNotBuyText);
    setCopyStatus(ok ? "Do not buy list copied." : "Copy failed.");
  };

  const handleCopyChangedLines = async () => {
    if (!result) return;
    const ok = await copyToClipboard(changedLinesText);
    setCopyStatus(ok ? "Changed lines copied." : "Copy failed.");
  };

  const handleCopyDoNotBuyLines = async () => {
    if (!result) return;
    const ok = await copyToClipboard(doNotBuyLinesText);
    setCopyStatus(ok ? "Do-not-buy lines copied." : "Copy failed.");
  };

  const hasChangedLines = Boolean(
    result &&
      result.comparison.rows.some(
        (row) =>
          row.state !== "safe" ||
          (typeof row.buyPerDelta === "number" && row.buyPerDelta !== 0) ||
          (typeof row.qtyDelta === "number" && row.qtyDelta !== 0),
      ),
  );
  const hasDoNotBuyLines = Boolean(result && result.comparison.rows.some((row) => row.state === "do_not_buy"));

  return (
    <div className="text-eve-text" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span>Batch Buy Manifest</span>
          <textarea
            aria-label="Batch Buy Manifest"
            rows={12}
            className={`${themedInputClassName} min-h-[18rem] resize-y font-mono text-xs leading-relaxed`}
            value={manifestText}
            onChange={(event) => setManifestText(event.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span>Export Order</span>
          <textarea
            aria-label="Export Order"
            rows={12}
            className={`${themedInputClassName} min-h-[18rem] resize-y font-mono text-xs leading-relaxed`}
            value={exportText}
            onChange={(event) => setExportText(event.target.value)}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={Boolean(slippageValidationMessage || priceDiffValidationMessage)}
        >
          Evaluate
        </button>
        <button type="button" onClick={handleClear}>
          Clear
        </button>
        <button type="button" onClick={handleCopySummary} disabled={!result}>
          Copy Summary
        </button>
        <button type="button" onClick={handleCopyDoNotBuy} disabled={!result}>
          Copy Do Not Buy List
        </button>
      </div>

      <section
        aria-label="Verifier controls"
        data-testid="verifier-controls-section"
        className="bg-eve-panel/40 text-eve-text"
        style={{ display: "grid", gap: 12, border: "1px solid #374151", borderRadius: 8, padding: 12 }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <span className="text-eve-dim">Mode</span>
          <label className="text-eve-dim">
            <input
              type="radio"
              name="toleranceMode"
              checked={toleranceMode === "sell_value_evaluate"}
              onChange={() => setToleranceMode("sell_value_evaluate")}
            />{" "}
            Sell Value Evaluate
          </label>
          <label className="text-eve-dim">
            <input
              type="radio"
              name="toleranceMode"
              checked={toleranceMode === "strict"}
              onChange={() => setToleranceMode("strict")}
            />{" "}
            Strict
          </label>
          <label className="text-eve-dim">
            <input
              type="radio"
              name="toleranceMode"
              checked={toleranceMode === "allow_slippage"}
              onChange={() => setToleranceMode("allow_slippage")}
            />{" "}
            Allow slippage
          </label>
        </div>

        <label style={{ display: "grid", gap: 6, maxWidth: 240 }}>
          <span className="text-eve-dim">Slippage type</span>
          <select
            aria-label="Slippage type"
            className={themedInputClassName}
            value={slippageType}
            disabled={toleranceMode !== "allow_slippage"}
            onChange={(event) => setSlippageType(event.target.value as SlippageType)}
          >
            <option value="isk">ISK</option>
            <option value="percent">%</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, maxWidth: 240 }}>
          <span className="text-eve-dim">Slippage value</span>
          <input
            aria-label="Slippage value"
            className={themedInputClassName}
            type="text"
            inputMode="decimal"
            value={slippageValueInput}
            disabled={toleranceMode !== "allow_slippage"}
            onChange={(event) => setSlippageValueInput(event.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: 6, maxWidth: 280 }}>
          <span className="text-eve-dim">Quantity handling</span>
          <select
            aria-label="Quantity handling"
            className={themedInputClassName}
            value={quantityHandling}
            onChange={(event) => setQuantityHandling(event.target.value as QuantityHandling)}
          >
            <option value="ignore_mismatch">Ignore mismatch</option>
            <option value="require_exact">Require exact</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, maxWidth: 280 }}>
          <span className="text-eve-dim">Price diff alert %</span>
          <input
            aria-label="Price diff alert percent"
            className={themedInputClassName}
            type="text"
            inputMode="decimal"
            value={priceDiffAlertPercentInput}
            onChange={(event) => setPriceDiffAlertPercentInput(event.target.value)}
          />
        </label>

        {slippageValidationMessage ? (
          <p role="alert" className="text-eve-error" style={{ margin: 0 }}>
            {slippageValidationMessage}
          </p>
        ) : null}
        {priceDiffValidationMessage ? (
          <p role="alert" className="text-eve-error" style={{ margin: 0 }}>
            {priceDiffValidationMessage}
          </p>
        ) : null}
      </section>

      {copyStatus ? <p role="status" className="text-eve-dim">{copyStatus}</p> : null}

      {!result && !hasInput ? <p className="text-eve-dim">Paste manifest and export data, then click Evaluate.</p> : null}

      {result ? (
        <div style={{ display: "grid", gap: 12 }}>
          <section aria-label="Evaluation summary" data-testid="evaluation-summary-section" style={sectionStyle}>
            <h3 style={{ margin: 0 }}>Summary ({result.modeLabel})</h3>
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <div className="text-eve-dim">Line count</div>
                <strong data-testid="summary-line-count">{result.comparison.aggregate.lineCount}</strong>
              </div>
              <div>
                <div className="text-eve-dim">Total planned / matched buy</div>
                <strong data-testid="summary-total-buy">
                  {formatSummaryTotal(result.comparison.aggregate.totalPlannedBuy)} /{" "}
                  {formatSummaryTotal(result.comparison.aggregate.totalMatchedBuy)} ISK
                </strong>
              </div>
              <div>
                <div className="text-eve-dim">Missing buy lines</div>
                <strong data-testid="summary-missing-lines">{result.comparison.aggregate.missingBuyLines}</strong>
              </div>
              <div>
                <div className="text-eve-dim">Total planned sell</div>
                <strong data-testid="summary-total-sell">
                  {formatSummaryTotal(result.comparison.aggregate.totalPlannedSell)} ISK
                </strong>
              </div>
              <div>
                <div className="text-eve-dim">Reduced-edge lines</div>
                <strong data-testid="summary-reduced-edge">{result.comparison.aggregate.reducedEdgeLineCount}</strong>
              </div>
              <div>
                <div className="text-eve-dim">Final verdict</div>
                {(() => {
                  const verdictMeta = getVerdictPresentation(result.comparison.aggregate.verdict);
                  return (
                    <span
                      data-testid="summary-verdict-badge"
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${verdictMeta.className}`}
                    >
                      {verdictMeta.label}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={handleCopyChangedLines} disabled={!hasChangedLines}>
                Copy Changed Lines
              </button>
              <button type="button" onClick={handleCopyDoNotBuyLines} disabled={!hasDoNotBuyLines}>
                Copy Do-Not-Buy Lines
              </button>
            </div>
            {result.comparison.summary.alertingRowsCount > 0 ? (
              <div
                role="alert"
                style={{
                  marginTop: 10,
                  border: "1px solid #92400e",
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: "#1f1606",
                  color: "#fde68a",
                }}
              >
                Warning: {result.comparison.summary.alertingRowsCount} row(s) exceed the configured{" "}
                {formatNumber(result.comparison.summary.alertThresholdPercent)}% difference threshold. Highest delta:{" "}
                {formatNumber(result.comparison.summary.maxPriceDiffPercent)}%.
              </div>
            ) : null}
          </section>
          <ParseDiagnostics diagnostics={result.diagnostics} />
          <ResultSection title="Buy these" rows={result.buyThese} />
          <ResultSection title="Do not buy these" rows={result.doNotBuyThese} />
          <ResultSection title="Missing / unavailable" rows={result.missing} />
          <ResultSection title="Unexpected extras" rows={result.unexpected} />
        </div>
      ) : null}
    </div>
  );
}
