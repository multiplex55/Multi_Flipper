import { type CSSProperties, useMemo, useState } from "react";
import { compareManifestToExport, type ComparisonRow } from "@/features/batchVerifier/compare";
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
};

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

function buildSummaryText(result: EvaluationResult): string {
  const lines = [
    `Buy these: ${result.buyThese.length}`,
    `Do not buy these: ${result.doNotBuyThese.length}`,
    `Missing / unavailable: ${result.missing.length}`,
    `Unexpected extras: ${result.unexpected.length}`,
  ];

  if (result.doNotBuyThese.length > 0) {
    lines.push("", "Do not buy list:");
    for (const row of result.doNotBuyThese) {
      lines.push(`- ${row.name} (${decisionForRow(row.state)}: ${row.reason})`);
    }
  }

  return lines.join("\n");
}

function buildDoNotBuyText(result: EvaluationResult): string {
  if (result.doNotBuyThese.length === 0) {
    return "No do-not-buy items.";
  }
  return result.doNotBuyThese.map((row) => row.name).join("\n");
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

  const hasInput = manifestText.trim().length > 0 || exportText.trim().length > 0;

  const summaryText = useMemo(() => (result ? buildSummaryText(result) : ""), [result]);
  const doNotBuyText = useMemo(() => (result ? buildDoNotBuyText(result) : ""), [result]);

  const handleEvaluate = () => {
    const manifestParsed = parseBatchManifest(manifestText);
    const exportParsed = parseExportOrder(exportText);
    const comparison = compareManifestToExport(manifestParsed.items, exportParsed.items, { includeReview: true });

    setResult({
      buyThese: comparison.buyThese,
      doNotBuyThese: [...comparison.doNotBuy, ...(comparison.review ?? [])],
      missing: comparison.missing,
      unexpected: comparison.unexpected,
      diagnostics: [...manifestParsed.errors, ...exportParsed.errors],
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
        <button type="button" onClick={handleEvaluate}>
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

      {copyStatus ? <p role="status">{copyStatus}</p> : null}

      {!result && !hasInput ? <p>Paste manifest and export data, then click Evaluate.</p> : null}

      {result ? (
        <div style={{ display: "grid", gap: 12 }}>
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
