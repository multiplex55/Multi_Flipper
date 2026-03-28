import { addToWatchlist } from "../../lib/api";
import type { TranslationKey } from "../../lib/i18n";

interface AddWithToastParams {
  typeId: number;
  typeName: string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  addToast: (text: string, type?: "info" | "success" | "error" | "warning", duration?: number) => number;
}

export async function addToWatchlistWithToast({
  typeId,
  typeName,
  t,
  addToast,
}: AddWithToastParams): Promise<boolean> {
  try {
    const result = await addToWatchlist(typeId, typeName);
    addToast(result.inserted ? t("watchlistItemAdded") : t("watchlistAlready"), "success", 2200);
    return result.inserted;
  } catch {
    addToast(t("watchlistError"), "error", 3000);
    throw new Error("watchlist-add-failed");
  }
}
