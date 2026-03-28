import { type CSSProperties, useMemo, useState } from "react";
import {
  compareManifestToExport,
  type ComparisonRow,
  type ComparisonOptions,
  type ComparisonResult,
} from "@/features/batchVerifier/compare";
import { formatDoNotBuyList, formatSummaryReport } from "@/features/batchVerifier/formatting";
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

type ToleranceMode = "strict" | "allow_slippage";
type SlippageType = "isk" | "percent";
type QuantityHandling = "ignore_mismatch" | "require_exact";

const statusStyles: Record<string, CSSProperties> = {
  safe: { backgroundColor: "#ecfdf3", color: "#166534" },
  do_not_buy: { backgroundColor: "#fef2f2", color: "#b91c1c" },
  quantity_mismatch: { backgroundColor: "#fefce8", color: "#854d0e" },
  missing_from_export: { backgroundColor: "#f3f4f6", color: "#374151" },
  unexpected_in_export: { backgroundColor: "#f3f4f6", color: "#374151" },
};

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
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Item name</th>
            <th>Manifest qty</th>
            <th>Export qty</th>
            <th>Target buy per</th>
            <th>Actual buy per</th>
            <th>Delta</th>
            <th>Decision</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.name}-${row.state}`} style={statusStyles[row.state]}>
              <td>{row.name}</td>
              <td>{formatNumber(row.manifestItem?.qty)}</td>
              <td>{formatNumber(row.exportItem?.qty)}</td>
              <td>{formatNumber(row.manifestItem?.buyPer)}</td>
              <td>{formatNumber(row.exportItem?.buyPer)}</td>
              <td>{formatNumber(row.buyPerDelta)}</td>
              <td>{decisionForRow(row.state)}</td>
              <td>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultSection({ title, rows }: { title: string; rows: ComparisonRow[] }) {
  return (
    <section aria-label={title} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {rows.length === 0 ? <p>No items.</p> : <ResultTable rows={rows} />}
    </section>
  );
}

function ParseDiagnostics({ diagnostics }: { diagnostics: ParseDiagnostic[] }) {
  if (diagnostics.length === 0) return null;

  return (
    <section aria-label="Parse diagnostics" style={{ border: "1px solid #f59e0b", borderRadius: 8, padding: 12 }}>
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

export function BatchBuyVerifier() {
  const [manifestText, setManifestText] = useState("");
  const [exportText, setExportText] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [toleranceMode, setToleranceMode] = useState<ToleranceMode>("strict");
  const [slippageType, setSlippageType] = useState<SlippageType>("isk");
  const [slippageValueInput, setSlippageValueInput] = useState<string>("0");
  const [quantityHandling, setQuantityHandling] = useState<QuantityHandling>("require_exact");

  const hasInput = manifestText.trim().length > 0 || exportText.trim().length > 0;

  const summaryText = useMemo(
    () => (result ? formatSummaryReport(result.comparison, { modeLabel: result.modeLabel }) : ""),
    [result],
  );
  const doNotBuyText = useMemo(() => (result ? formatDoNotBuyList(result.comparison) : ""), [result]);

  const slippageValue = useMemo(() => {
    if (slippageValueInput.trim() === "") return Number.NaN;
    return Number(slippageValueInput);
  }, [slippageValueInput]);

  const slippageValidationMessage = useMemo(() => {
    if (toleranceMode === "strict") return "";
    if (!Number.isFinite(slippageValue)) return "Slippage value must be a valid number.";
    if (slippageValue < 0) return "Slippage value must be non-negative.";
    if (slippageType === "percent" && slippageValue > 100) return "Percent slippage must be between 0 and 100.";
    return "";
  }, [slippageType, slippageValue, toleranceMode]);

  const optionsForCompare = useMemo<ComparisonOptions>(() => {
    const base: ComparisonOptions = {
      includeReview: true,
      enableQuantityMismatch: quantityHandling === "require_exact",
    };

    if (toleranceMode === "strict") {
      return {
        ...base,
        thresholdMode: "strict",
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
  }, [quantityHandling, slippageType, slippageValue, toleranceMode]);

  const modeSummaryLabel = useMemo(() => {
    const quantityLabel = quantityHandling === "require_exact" ? "quantity exact" : "ignore quantity mismatch";
    if (toleranceMode === "strict") return `Strict, ${quantityLabel}`;
    const toleranceLabel = slippageType === "isk" ? `${slippageValueInput} ISK` : `${slippageValueInput}%`;
    return `Allow slippage (${toleranceLabel}), ${quantityLabel}`;
  }, [quantityHandling, slippageType, slippageValueInput, toleranceMode]);

  const handleEvaluate = () => {
    if (slippageValidationMessage) return;
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span>Batch Buy Manifest</span>
          <textarea
            aria-label="Batch Buy Manifest"
            rows={12}
            value={manifestText}
            onChange={(event) => setManifestText(event.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span>Export Order</span>
          <textarea
            aria-label="Export Order"
            rows={12}
            value={exportText}
            onChange={(event) => setExportText(event.target.value)}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={handleEvaluate} disabled={Boolean(slippageValidationMessage)}>
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
        style={{ display: "grid", gap: 12, border: "1px solid #d1d5db", borderRadius: 8, padding: 12 }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <span>Mode</span>
          <label>
            <input
              type="radio"
              name="toleranceMode"
              checked={toleranceMode === "strict"}
              onChange={() => setToleranceMode("strict")}
            />{" "}
            Strict
          </label>
          <label>
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
          <span>Slippage type</span>
          <select
            aria-label="Slippage type"
            value={slippageType}
            disabled={toleranceMode === "strict"}
            onChange={(event) => setSlippageType(event.target.value as SlippageType)}
          >
            <option value="isk">ISK</option>
            <option value="percent">%</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, maxWidth: 240 }}>
          <span>Slippage value</span>
          <input
            aria-label="Slippage value"
            type="text"
            inputMode="decimal"
            value={slippageValueInput}
            disabled={toleranceMode === "strict"}
            onChange={(event) => setSlippageValueInput(event.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: 6, maxWidth: 280 }}>
          <span>Quantity handling</span>
          <select
            aria-label="Quantity handling"
            value={quantityHandling}
            onChange={(event) => setQuantityHandling(event.target.value as QuantityHandling)}
          >
            <option value="ignore_mismatch">Ignore mismatch</option>
            <option value="require_exact">Require exact</option>
          </select>
        </label>

        {slippageValidationMessage ? (
          <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
            {slippageValidationMessage}
          </p>
        ) : null}
      </section>

      {copyStatus ? <p role="status">{copyStatus}</p> : null}

      {!result && !hasInput ? <p>Paste manifest and export data, then click Evaluate.</p> : null}

      {result ? (
        <div style={{ display: "grid", gap: 12 }}>
          <section aria-label="Evaluation summary" style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12 }}>
            <h3 style={{ margin: 0 }}>Summary ({result.modeLabel})</h3>
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
