import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as compareModule from "@/features/batchVerifier/compare";
import { BatchBuyVerifier } from "@/features/batchVerifier/BatchBuyVerifier";

const writeTextMock = vi.fn();

beforeEach(() => {
  writeTextMock.mockReset();
  writeTextMock.mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: {
      writeText: writeTextMock,
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const manifestText = [
  "Tritanium | qty 10 | buy per 5 | buy total 50",
  "Pyerite | qty 8 | buy per 4 | buy total 32",
  "Mexallon | qty 5 | buy per 3 | buy total 15",
].join("\n");

const exportText = [
  ["Tritanium", "10", "5", "50"].join("\t"),
  ["Pyerite", "8", "6", "48"].join("\t"),
  ["Nocxium", "2", "9", "18"].join("\t"),
].join("\n");

describe("BatchBuyVerifier", () => {
  it("defaults to Sell Value Evaluate and renders mode radios in expected order", () => {
    render(<BatchBuyVerifier />);

    const sellValueEvaluateRadio = screen.getByLabelText("Sell Value Evaluate");
    const strictRadio = screen.getByLabelText("Strict");
    const allowSlippageRadio = screen.getByLabelText("Allow slippage");

    expect(sellValueEvaluateRadio).toBeChecked();
    expect(strictRadio).not.toBeChecked();
    expect(allowSlippageRadio).not.toBeChecked();
    expect(screen.getByLabelText("Slippage type")).toBeDisabled();
    expect(screen.getByLabelText("Slippage value")).toBeDisabled();

    const modeRadios = screen.getAllByRole("radio", { name: /Sell Value Evaluate|Strict|Allow slippage/i });
    expect(modeRadios.map((radio) => radio.getAttribute("aria-label") ?? radio.parentElement?.textContent?.trim())).toEqual([
      "Sell Value Evaluate",
      "Strict",
      "Allow slippage",
    ]);
  });

  it("uses Sell Value Evaluate compare mode by default without user interaction", () => {
    const compareSpy = vi.spyOn(compareModule, "compareManifestToExport");
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: manifestText } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: exportText } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(compareSpy.mock.calls[0]?.[2]).toMatchObject({
      thresholdMode: "sell_value_evaluate",
      priceDiffAlertPercent: 10,
      enableQuantityMismatch: true,
      includeReview: true,
    });
    expect(screen.getByText("Summary (Sell Value Evaluate, quantity exact)")).toBeInTheDocument();
  });

  it("passes selected control options into compare function", () => {
    const compareSpy = vi.spyOn(compareModule, "compareManifestToExport");
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: manifestText } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: exportText } });
    fireEvent.click(screen.getByLabelText("Allow slippage"));
    fireEvent.change(screen.getByLabelText("Slippage type"), { target: { value: "percent" } });
    fireEvent.change(screen.getByLabelText("Slippage value"), { target: { value: "12.5" } });
    fireEvent.change(screen.getByLabelText("Quantity handling"), { target: { value: "ignore_mismatch" } });

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(compareSpy.mock.calls[0]?.[2]).toMatchObject({
      thresholdMode: "percent_tolerance",
      percentTolerance: 12.5,
      priceDiffAlertPercent: 10,
      enableQuantityMismatch: false,
      includeReview: true,
    });
  });

  it("renders dual input areas and action buttons", () => {
    render(<BatchBuyVerifier />);

    const manifestTextarea = screen.getByLabelText("Batch Buy Manifest");
    const exportTextarea = screen.getByLabelText("Export Order");

    expect(manifestTextarea).toBeInTheDocument();
    expect(exportTextarea).toBeInTheDocument();
    expect(manifestTextarea).toHaveClass("bg-eve-input", "border-eve-border", "text-eve-text");
    expect(exportTextarea).toHaveClass("bg-eve-input", "border-eve-border", "text-eve-text");
    expect(screen.getByRole("button", { name: "Evaluate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Do Not Buy List" })).toBeInTheDocument();
  });

  it("hydrates manifest from initialManifestText and keeps Export Order empty", () => {
    render(<BatchBuyVerifier initialManifestText="Tritanium 10" />);

    expect(screen.getByLabelText("Batch Buy Manifest")).toHaveValue("Tritanium 10");
    expect(screen.getByLabelText("Export Order")).toHaveValue("");
  });

  it("updates hydrated manifest when initialManifestText changes", () => {
    const { rerender } = render(<BatchBuyVerifier initialManifestText="Tritanium 10" />);
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: "export row" } });

    rerender(<BatchBuyVerifier initialManifestText="Pyerite 5" />);

    expect(screen.getByLabelText("Batch Buy Manifest")).toHaveValue("Pyerite 5");
    expect(screen.getByLabelText("Export Order")).toHaveValue("");
  });

  it("Evaluate triggers parser+compare pipeline and displays grouped sections", () => {
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: manifestText } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: exportText } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByRole("heading", { name: "Buy these" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Do not buy these" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Missing / unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unexpected extras" })).toBeInTheDocument();

    expect(screen.getByText("Tritanium")).toBeInTheDocument();
    expect(screen.getByText("Pyerite")).toBeInTheDocument();
    expect(screen.getByText("Mexallon")).toBeInTheDocument();
    expect(screen.getByText("Nocxium")).toBeInTheDocument();

    expect(screen.getByLabelText("Batch Buy Manifest")).toHaveValue(manifestText);
    expect(screen.getByLabelText("Export Order")).toHaveValue(exportText);
  });

  it("Clear resets text and results", () => {
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: manifestText } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: exportText } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByLabelText("Batch Buy Manifest")).toHaveValue("");
    expect(screen.getByLabelText("Export Order")).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Buy these" })).not.toBeInTheDocument();
  });

  it("Copy Summary / Copy Do Not Buy produce expected text payloads", async () => {
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: manifestText } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: exportText } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    fireEvent.click(screen.getByRole("button", { name: "Copy Summary" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });

    const summaryPayload = writeTextMock.mock.calls[0][0] as string;
    expect(summaryPayload).toContain("Mode: Sell Value Evaluate, quantity exact");
    expect(summaryPayload).toContain("Safe: 0");
    expect(summaryPayload).toContain("Do not buy: 2");
    expect(summaryPayload).toContain("Missing from export: 1");
    expect(summaryPayload).toContain("Unexpected in export: 1");
    expect(summaryPayload).toContain("Price diff alert threshold (%): 10.00");
    expect(summaryPayload).toContain("Rows above alert threshold: 1");
    expect(summaryPayload).toContain("Extra ISK vs plan: 16.00 ISK");
    expect(summaryPayload).toContain("Profit impact: 0.00 ISK");

    fireEvent.click(screen.getByRole("button", { name: "Copy Do Not Buy List" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(2);
    });

    const doNotBuyPayload = writeTextMock.mock.calls[1][0] as string;
    expect(doNotBuyPayload).toContain("Pyerite — Cannot evaluate sell-value threshold: manifest sell-per is missing.");
    expect(doNotBuyPayload).toContain("Mexallon — Missing from export order.");
    expect(doNotBuyPayload).toContain("Nocxium — Unexpected item in export order.");
    expect(doNotBuyPayload).toContain("Tritanium — Cannot evaluate sell-value threshold: manifest sell-per is missing.");
  });

  it("renders verdict badge for all summary states", () => {
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), {
      target: { value: "Tritanium | qty 10 | buy per 5 | buy total 50 | sell per 6" },
    });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: "Tritanium\t10\t5\t50" } });
    fireEvent.click(screen.getByLabelText("Sell Value Evaluate"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByTestId("summary-verdict-badge")).toHaveTextContent("Good");

    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: "Tritanium\t10\t5.2\t52" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByTestId("summary-verdict-badge")).toHaveTextContent("Reduced edge");

    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: "Tritanium\t10\t7\t70" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByTestId("summary-verdict-badge")).toHaveTextContent("Abort");
  });

  it("shows aggregate summary totals from fixture data", () => {
    render(<BatchBuyVerifier />);

    const aggregateManifest = [
      "Tritanium | qty 10 | buy per 5 | buy total 50 | sell per 7",
      "Pyerite | qty 8 | buy per 4 | buy total 32 | sell per 6",
      "Mexallon | qty 5 | buy per 3 | buy total 15 | sell per 4",
    ].join("\n");
    const aggregateExport = [
      ["Tritanium", "10", "5", "50"].join("\t"),
      ["Pyerite", "8", "4.5", "36"].join("\t"),
    ].join("\n");

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: aggregateManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: aggregateExport } });
    fireEvent.click(screen.getByLabelText("Sell Value Evaluate"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByTestId("summary-line-count")).toHaveTextContent("3");
    expect(screen.getByTestId("summary-total-buy")).toHaveTextContent("97 / 86 ISK");
    expect(screen.getByTestId("summary-missing-lines")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-total-sell")).toHaveTextContent("138 ISK");
    expect(screen.getByTestId("summary-reduced-edge")).toHaveTextContent("1");
  });

  it("copy summary actions include only intended lines", async () => {
    render(<BatchBuyVerifier />);

    const copyManifest = [
      "Tritanium | qty 10 | buy per 5 | buy total 50 | sell per 6",
      "Pyerite | qty 8 | buy per 4 | buy total 32 | sell per 6",
      "Mexallon | qty 5 | buy per 3 | buy total 15 | sell per 4",
    ].join("\n");
    const copyExport = [
      ["Tritanium", "10", "5", "50"].join("\t"),
      ["Pyerite", "8", "4.5", "36"].join("\t"),
      ["Mexallon", "5", "5", "25"].join("\t"),
    ].join("\n");

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: copyManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: copyExport } });
    fireEvent.click(screen.getByLabelText("Sell Value Evaluate"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    fireEvent.click(screen.getByRole("button", { name: "Copy Changed Lines" }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1));
    const changedPayload = writeTextMock.mock.calls[0][0] as string;
    expect(changedPayload).toContain("Pyerite");
    expect(changedPayload).toContain("Mexallon");
    expect(changedPayload).not.toContain("Tritanium");

    fireEvent.click(screen.getByRole("button", { name: "Copy Do-Not-Buy Lines" }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(2));
    const blockedPayload = writeTextMock.mock.calls[1][0] as string;
    expect(blockedPayload).toContain("Mexallon");
    expect(blockedPayload).not.toContain("Pyerite");
    expect(blockedPayload).not.toContain("Tritanium");
  });

  it("shows parse errors without crashing", () => {
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), {
      target: { value: "Bad Item | qty x | buy per 5" },
    });
    fireEvent.change(screen.getByLabelText("Export Order"), {
      target: { value: "Broken\trow" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByRole("heading", { name: "Parse diagnostics" })).toBeInTheDocument();
    expect(screen.getByText(/invalid numeric value for qty/i)).toBeInTheDocument();
    expect(screen.getByText(/expected 4 tab-delimited columns/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buy these" })).toBeInTheDocument();
  });

  it("strict mode marks overpriced item do-not-buy while tolerant mode marks it safe", () => {
    render(<BatchBuyVerifier />);
    const strictManifest = "Tritanium | qty 10 | buy per 5 | buy total 50";
    const strictExport = "Tritanium\t10\t6\t60";

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: strictManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: strictExport } });

    fireEvent.click(screen.getByLabelText("Strict"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByRole("heading", { name: "Do not buy these" })).toBeInTheDocument();
    expect(screen.getByText("Tritanium")).toBeInTheDocument();
    expect(screen.getByText("Summary (Strict, quantity exact)")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Allow slippage"));
    fireEvent.change(screen.getByLabelText("Slippage type"), { target: { value: "isk" } });
    fireEvent.change(screen.getByLabelText("Slippage value"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    const buySection = screen.getByRole("region", { name: "Buy these" });
    expect(buySection).toHaveTextContent("Tritanium");
    expect(screen.getByText("Summary (Allow slippage (1 ISK), quantity exact)")).toBeInTheDocument();
  });

  it("quantity handling toggle changes classification outcome", () => {
    render(<BatchBuyVerifier />);
    const quantityManifest = "Tritanium | qty 10 | buy per 5 | buy total 50";
    const quantityExport = "Tritanium\t9\t5\t45";

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: quantityManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: quantityExport } });
    fireEvent.click(screen.getByLabelText("Strict"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByRole("heading", { name: "Do not buy these" }).closest("section")).toHaveTextContent("Tritanium");

    fireEvent.change(screen.getByLabelText("Quantity handling"), { target: { value: "ignore_mismatch" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    const buySection = screen.getByRole("region", { name: "Buy these" });
    expect(buySection).toHaveTextContent("Tritanium");
  });

  it("supports Sell Value Evaluate mode and updates summary label", () => {
    render(<BatchBuyVerifier />);
    const sellModeManifest = "Tritanium | qty 10 | buy per 5 | buy total 50 | sell per 6";
    const sellModeExport = "Tritanium\t10\t5.5\t55";

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: sellModeManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: sellModeExport } });
    fireEvent.click(screen.getByLabelText("Sell Value Evaluate"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByText("Summary (Sell Value Evaluate, quantity exact)")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Buy these" })).toHaveTextContent("Tritanium");
  });

  it("sell-value mode changes classification and handles missing sellPer", () => {
    render(<BatchBuyVerifier />);

    const noSellManifest = "Tritanium | qty 10 | buy per 5 | buy total 50";
    const exportAtFivePointFive = "Tritanium\t10\t5.5\t55";

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: noSellManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: exportAtFivePointFive } });
    fireEvent.click(screen.getByLabelText("Sell Value Evaluate"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByRole("region", { name: "Do not buy these" })).toHaveTextContent("Tritanium");
    expect(screen.getByText(/missing sell-per/i)).toBeInTheDocument();

    const hasSellManifest = "Tritanium | qty 10 | buy per 5 | buy total 50 | sell per 6";
    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: hasSellManifest } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByRole("region", { name: "Buy these" })).toHaveTextContent("Tritanium");
  });

  it("invalid tolerance disables Evaluate and shows inline validation", () => {
    render(<BatchBuyVerifier />);
    fireEvent.click(screen.getByLabelText("Allow slippage"));
    fireEvent.change(screen.getByLabelText("Slippage type"), { target: { value: "percent" } });
    fireEvent.change(screen.getByLabelText("Slippage value"), { target: { value: "250" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Percent slippage must be between 0 and 100.");
    expect(screen.getByRole("button", { name: "Evaluate" })).toBeDisabled();
  });

  it("invalid price diff threshold blocks Evaluate and shows inline validation", () => {
    render(<BatchBuyVerifier />);
    fireEvent.change(screen.getByLabelText("Price diff alert percent"), { target: { value: "-1" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Price diff alert % must be non-negative.");
    expect(screen.getByRole("button", { name: "Evaluate" })).toBeDisabled();
  });

  it("shows warning in summary when configured threshold is exceeded", () => {
    render(<BatchBuyVerifier />);
    const alertManifest = "Tritanium | qty 10 | buy per 5 | buy total 50";
    const alertExport = "Tritanium\t10\t6\t60";

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: alertManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: alertExport } });
    fireEvent.change(screen.getByLabelText("Price diff alert percent"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    expect(screen.getByRole("alert")).toHaveTextContent("1 row(s) exceed");
    expect(screen.getByRole("alert")).toHaveTextContent("Highest delta: 20%");
  });

  it("does not show threshold warning when all rows are within configured limit", () => {
    render(<BatchBuyVerifier />);
    const withinManifest = "Tritanium | qty 10 | buy per 5 | buy total 50";
    const withinExport = "Tritanium\t10\t5.2\t52";

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: withinManifest } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: withinExport } });
    fireEvent.change(screen.getByLabelText("Price diff alert percent"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    const summary = screen.getByTestId("evaluation-summary-section");
    expect(within(summary).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses dark-mode-safe row and section styles while preserving per-state distinction", () => {
    render(<BatchBuyVerifier />);

    fireEvent.change(screen.getByLabelText("Batch Buy Manifest"), { target: { value: manifestText } });
    fireEvent.change(screen.getByLabelText("Export Order"), { target: { value: exportText } });
    fireEvent.click(screen.getByLabelText("Strict"));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    const evaluationSummary = screen.getByTestId("evaluation-summary-section");
    const verifierControls = screen.getByTestId("verifier-controls-section");
    expect(evaluationSummary).toHaveStyle({ borderColor: "#374151", borderStyle: "solid" });
    expect(verifierControls).toHaveStyle({ borderColor: "#374151", borderStyle: "solid" });
    expect(evaluationSummary).not.toHaveStyle({ borderColor: "#d1d5db" });
    expect(verifierControls).not.toHaveStyle({ borderColor: "#d1d5db" });

    const table = screen.getAllByTestId("batch-verifier-result-table")[0];
    expect(table).toHaveStyle({ backgroundColor: "#0b1220", color: "#e5e7eb" });
    const headerCell = within(table).getByRole("columnheader", { name: "Item name" });
    expect(headerCell).toHaveStyle({ backgroundColor: "#111827", color: "#e5e7eb", borderBottom: "1px solid #4b5563" });

    const safeRow = screen.getByTestId("result-row-safe");
    const doNotBuyRow = screen.getByTestId("result-row-do_not_buy");
    const missingRow = screen.getByTestId("result-row-missing_from_export");
    const unexpectedRow = screen.getByTestId("result-row-unexpected_in_export");

    expect(safeRow).toHaveStyle({ backgroundColor: "#052e16", color: "#bbf7d0" });
    expect(doNotBuyRow).toHaveStyle({ backgroundColor: "#450a0a", color: "#fecaca" });
    expect(missingRow).toHaveStyle({ backgroundColor: "#1f2937", color: "#e5e7eb" });
    expect(unexpectedRow).toHaveStyle({ backgroundColor: "#0f172a", color: "#cbd5e1" });

    expect(safeRow).not.toHaveStyle({ backgroundColor: "#ecfdf3" });
    expect(doNotBuyRow).not.toHaveStyle({ backgroundColor: "#fef2f2" });
    expect(missingRow).not.toHaveStyle({ backgroundColor: "#f3f4f6" });
    expect(unexpectedRow).not.toHaveStyle({ backgroundColor: "#f3f4f6" });
  });
});
