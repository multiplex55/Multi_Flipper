import { useMemo, useState } from "react";
import type { BanlistState } from "@/lib/banlist";
import { isItemBanned } from "@/lib/banlist";
import type { FlipResult, RouteResult } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type KnownItem = { typeId: number; typeName: string };

type BanlistModalProps = {
  banlist: BanlistState;
  latestResults: FlipResult[];
  routeResults: RouteResult[];
  onAdd: (item: KnownItem) => void;
  onRemove: (typeId: number) => void;
  onClear: () => void;
};

function collectKnownItems(latestResults: FlipResult[], routeResults: RouteResult[]): KnownItem[] {
  // NOTE: this must operate on raw (unfiltered) result sets so banlist suggestions
  // can re-surface recently unbanned items instead of starving from filtered tables.
  const byId = new Map<number, string>();
  const rememberItem = (typeId: number, typeName?: string) => {
    if (typeId <= 0 || byId.has(typeId)) return;
    byId.set(typeId, typeName || `Type ${typeId}`);
  };

  for (const row of latestResults) {
    rememberItem(row.TypeID, row.TypeName);
  }
  for (const route of routeResults) {
    for (const hop of route.Hops ?? []) {
      rememberItem(hop.TypeID, hop.TypeName);
      for (const item of hop.Items ?? []) rememberItem(item.TypeID, item.TypeName);
    }
  }
  return [...byId.entries()]
    .map(([typeId, typeName]) => ({ typeId, typeName }))
    .sort((a, b) => {
      const byName = a.typeName.localeCompare(b.typeName);
      return byName !== 0 ? byName : a.typeId - b.typeId;
    });
}

export function BanlistModal({ banlist, latestResults, routeResults, onAdd, onRemove, onClear }: BanlistModalProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const knownItems = useMemo(() => collectKnownItems(latestResults, routeResults), [latestResults, routeResults]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return knownItems
      .filter((item) => !isItemBanned(banlist, item.typeId))
      .filter((item) => (q ? item.typeName.toLowerCase().includes(q) || String(item.typeId).includes(q) : true))
      .slice(0, 25);
  }, [knownItems, banlist, query]);

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs text-eve-dim">{t("banlistAddItem")}</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("banlistSearchPlaceholder")}
          className="w-full px-2.5 py-2 bg-eve-input border border-eve-border rounded-sm text-sm"
        />
        <div className="max-h-40 overflow-auto border border-eve-border/60 rounded-sm">
          {suggestions.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-eve-dim">{t("banlistNoSearchResults")}</div>
          ) : (
            suggestions.map((item) => (
              <button
                key={item.typeId}
                onClick={() => {
                  onAdd(item);
                  setQuery("");
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-eve-accent/10 border-b border-eve-border/40 last:border-b-0"
              >
                {item.typeName} <span className="text-eve-dim">#{item.typeId}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-eve-text">{t("banlistCurrent")}</h3>
        <button
          onClick={() => {
            onClear();
            setQuery("");
          }}
          disabled={banlist.entries.length === 0}
          className="px-2 py-1 text-xs rounded-sm border border-eve-border disabled:opacity-40"
        >
          {t("banlistClearAll")}
        </button>
      </div>

      <div className="border border-eve-border rounded-sm max-h-72 overflow-auto">
        {banlist.entries.length === 0 ? (
          <div className="px-3 py-4 text-sm text-eve-dim">{t("banlistEmpty")}</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-eve-panel border-b border-eve-border">
              <tr>
                <th className="px-3 py-2 text-left">{t("colItem")}</th>
                <th className="px-3 py-2 text-right">{t("watchlistAlertActions")}</th>
              </tr>
            </thead>
            <tbody>
              {banlist.entries.map((item) => (
                <tr key={item.typeId} className="border-b border-eve-border/40 last:border-b-0">
                  <td className="px-3 py-2">{item.typeName}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onRemove(item.typeId)}
                      className="px-2 py-1 rounded-sm border border-eve-border hover:border-eve-error/60 hover:text-eve-error"
                    >
                      {t("banlistRemove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
