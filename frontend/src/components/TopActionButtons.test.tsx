import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopActionButtons } from "@/components/TopActionButtons";

afterEach(() => {
  cleanup();
});

describe("TopActionButtons", () => {
  it("renders Watchlist and Batch Price Verify buttons together", () => {
    render(
      <TopActionButtons
        watchlistLabel="Watchlist"
        banlistLabel="Banlist"
        verifierLabel="Batch Price Verify"
        onOpenWatchlist={vi.fn()}
        onOpenBanlist={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Watchlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Banlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batch Price Verify" })).toBeInTheDocument();
  });

  it("clicking Batch Price Verify opens verifier UI", () => {
    render(
      <TopActionButtons
        watchlistLabel="Watchlist"
        banlistLabel="Banlist"
        verifierLabel="Batch Price Verify"
        onOpenWatchlist={vi.fn()}
        onOpenBanlist={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Batch Price Verify" }));

    expect(screen.getByRole("dialog", { name: "Batch Price Verify" })).toBeInTheDocument();
    expect(screen.getByLabelText("Batch Buy Manifest")).toBeInTheDocument();
    expect(screen.getByLabelText("Export Order")).toBeInTheDocument();
  });

  it("opens with prefilled manifest when controlled by builder path", () => {
    const manifest = "Tritanium 10";
    render(
      <TopActionButtons
        watchlistLabel="Watchlist"
        banlistLabel="Banlist"
        verifierLabel="Batch Price Verify"
        onOpenWatchlist={vi.fn()}
        onOpenBanlist={vi.fn()}
        verifierOpen
        initialManifestText={manifest}
        onOpenVerifier={vi.fn()}
        onCloseVerifier={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Batch Price Verify" })).toBeInTheDocument();
    expect(screen.getByLabelText("Batch Buy Manifest")).toHaveValue(manifest);
    expect(screen.getByLabelText("Export Order")).toHaveValue("");
  });

  it("modal close returns focus to trigger button", async () => {
    render(
      <TopActionButtons
        watchlistLabel="Watchlist"
        banlistLabel="Banlist"
        verifierLabel="Batch Price Verify"
        onOpenWatchlist={vi.fn()}
        onOpenBanlist={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Batch Price Verify" });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("preserves Watchlist click behavior", () => {
    const onOpenWatchlist = vi.fn();

    render(
      <TopActionButtons
        watchlistLabel="Watchlist"
        banlistLabel="Banlist"
        verifierLabel="Batch Price Verify"
        onOpenWatchlist={onOpenWatchlist}
        onOpenBanlist={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist" }));

    expect(onOpenWatchlist).toHaveBeenCalledTimes(1);
  });

  it("fires Banlist callback when clicked", () => {
    const onOpenBanlist = vi.fn();
    render(
      <TopActionButtons
        watchlistLabel="Watchlist"
        banlistLabel="Banlist"
        verifierLabel="Batch Price Verify"
        onOpenWatchlist={vi.fn()}
        onOpenBanlist={onOpenBanlist}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Banlist" }));
    expect(onOpenBanlist).toHaveBeenCalledTimes(1);
  });
});
