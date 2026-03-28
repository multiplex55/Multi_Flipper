import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      enableQuantityMismatch: false,
      includeReview: true,
    });
  });

  it("renders dual input areas and action buttons", () => {
    render(<BatchBuyVerifier />);

    expect(screen.getByLabelText("Batch Buy Manifest")).toBeInTheDocument();
    expect(screen.getByLabelText("Export Order")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Evaluate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Do Not Buy List" })).toBeInTheDocument();
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
    expect(summaryPayload).toContain("Buy these: 1");
    expect(summaryPayload).toContain("Do not buy these: 1");
    expect(summaryPayload).toContain("Missing / unavailable: 1");
    expect(summaryPayload).toContain("Unexpected extras: 1");

    fireEvent.click(screen.getByRole("button", { name: "Copy Do Not Buy List" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(2);
    });

    const doNotBuyPayload = writeTextMock.mock.calls[1][0] as string;
    expect(doNotBuyPayload).toContain("Pyerite");
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
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(screen.getByRole("heading", { name: "Do not buy these" }).closest("section")).toHaveTextContent("Tritanium");

    fireEvent.change(screen.getByLabelText("Quantity handling"), { target: { value: "ignore_mismatch" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate" }));

    const buySection = screen.getByRole("region", { name: "Buy these" });
    expect(buySection).toHaveTextContent("Tritanium");
  });

  it("invalid tolerance disables Evaluate and shows inline validation", () => {
    render(<BatchBuyVerifier />);
    fireEvent.click(screen.getByLabelText("Allow slippage"));
    fireEvent.change(screen.getByLabelText("Slippage type"), { target: { value: "percent" } });
    fireEvent.change(screen.getByLabelText("Slippage value"), { target: { value: "250" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Percent slippage must be between 0 and 100.");
    expect(screen.getByRole("button", { name: "Evaluate" })).toBeDisabled();
  });
});
