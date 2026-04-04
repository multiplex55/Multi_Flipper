import { useCallback, useEffect, useMemo, useState } from "react";
import type { FlipResult, BannedStation, BanlistItem, StationInfo } from "@/lib/types";
import {
  addBannedStation,
  addBanlistItem,
  getBannedStations,
  getBanlistItems,
  getStations,
  getSystemsList,
  removeBannedStation,
  removeBanlistItem,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useGlobalToast } from "@/components/Toast";

type Props = {
  latestResults: FlipResult[];
};

type StationCandidate = {
  id: number;
  name: string;
  system_id?: number;
  system_name?: string;
};

export function BanlistTab({ latestResults }: Props) {
  const { t } = useI18n();
  const { addToast } = useGlobalToast();
  const [items, setItems] = useState<BanlistItem[]>([]);
  const [stations, setStations] = useState<BannedStation[]>([]);

  const [itemSearch, setItemSearch] = useState("");
  const [stationSystem, setStationSystem] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [systemSuggestions, setSystemSuggestions] = useState<string[]>([]);
  const [systemLookupLoading, setSystemLookupLoading] = useState(false);
  const [stationOptions, setStationOptions] = useState<StationInfo[]>([]);
  const [stationLookupLoading, setStationLookupLoading] = useState(false);

  const reload = useCallback(() => {
    Promise.all([getBanlistItems(), getBannedStations()])
      .then(([nextItems, nextStations]) => {
        setItems(nextItems);
        setStations(nextStations);
      })
      .catch(() => {
        addToast(t("banlistLoadError"), "error", 3000);
      });
  }, [addToast, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const itemCandidates = useMemo(() => {
    const mapped = latestResults
      .filter((row) => row.TypeID > 0)
      .map((row) => ({ type_id: row.TypeID, type_name: row.TypeName }));
    const uniq = new Map<number, { type_id: number; type_name: string }>();
    for (const entry of mapped) {
      if (!uniq.has(entry.type_id)) uniq.set(entry.type_id, entry);
    }
    return [...uniq.values()].sort((a, b) => a.type_name.localeCompare(b.type_name));
  }, [latestResults]);

  const filteredItemCandidates = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return itemCandidates.slice(0, 100);
    return itemCandidates
      .filter((item) => item.type_name.toLowerCase().includes(q) || String(item.type_id) === q)
      .slice(0, 100);
  }, [itemCandidates, itemSearch]);

  const stationCandidates = useMemo(() => {
    const fromResults: StationCandidate[] = [];
    for (const row of latestResults) {
      if ((row.BuyLocationID ?? 0) > 0) {
        fromResults.push({
          id: row.BuyLocationID ?? 0,
          name: row.BuyStation,
          system_id: row.BuySystemID,
          system_name: row.BuySystemName,
        });
      }
      if ((row.SellLocationID ?? 0) > 0) {
        fromResults.push({
          id: row.SellLocationID ?? 0,
          name: row.SellStation,
          system_id: row.SellSystemID,
          system_name: row.SellSystemName,
        });
      }
    }

    const fromLookup = stationOptions.map((station) => ({
      id: station.id,
      name: station.name,
      system_id: station.system_id,
      system_name: stationSystem.trim() || undefined,
    }));

    const uniq = new Map<number, StationCandidate>();
    for (const entry of [...fromLookup, ...fromResults]) {
      if (!uniq.has(entry.id)) uniq.set(entry.id, entry);
    }
    return [...uniq.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [latestResults, stationOptions, stationSystem]);

  const filteredStationCandidates = useMemo(() => {
    const q = stationSearch.trim().toLowerCase();
    if (!q) return stationCandidates.slice(0, 100);
    return stationCandidates
      .filter((station) => station.name.toLowerCase().includes(q) || String(station.id) === q)
      .slice(0, 100);
  }, [stationCandidates, stationSearch]);

  useEffect(() => {
    const query = stationSystem.trim();
    if (query.length < 2) {
      setSystemSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setSystemLookupLoading(true);
    getSystemsList(query, 10, controller.signal)
      .then((systems) => {
        setSystemSuggestions(systems.map((system) => system.name));
      })
      .catch(() => {
        // no-op (input assistance only)
      })
      .finally(() => {
        setSystemLookupLoading(false);
      });

    return () => controller.abort();
  }, [stationSystem]);

  useEffect(() => {
    const query = stationSystem.trim();
    if (query.length < 2) {
      setStationOptions([]);
      return;
    }
    const controller = new AbortController();
    setStationLookupLoading(true);
    getStations(query, controller.signal)
      .then((response) => {
        setStationOptions(response.stations ?? []);
      })
      .catch(() => {
        setStationOptions([]);
      })
      .finally(() => {
        setStationLookupLoading(false);
      });

    return () => controller.abort();
  }, [stationSystem]);

  const handleAddItem = async () => {
    const query = itemSearch.trim().toLowerCase();
    const selected = itemCandidates.find(
      (entry) => entry.type_name.toLowerCase() === query || String(entry.type_id) === query,
    );
    if (!selected) {
      addToast(t("banlistSelectItemPrompt"), "error", 2500);
      return;
    }

    const previous = items;
    const optimistic = {
      type_id: selected.type_id,
      type_name: selected.type_name,
      added_at: new Date().toISOString(),
    };
    if (!previous.some((entry) => entry.type_id === selected.type_id)) {
      setItems([optimistic, ...previous]);
    }

    try {
      const result = await addBanlistItem(selected.type_id, selected.type_name);
      setItems(result.items);
      setItemSearch("");
      addToast(
        result.inserted ? t("banlistItemAdded") : t("banlistItemAlready"),
        "success",
        2000,
      );
    } catch {
      setItems(previous);
      addToast(t("banlistAddItemError"), "error", 3000);
    }
  };

  const handleRemoveItem = async (typeId: number) => {
    const previous = items;
    setItems(previous.filter((entry) => entry.type_id !== typeId));
    try {
      const next = await removeBanlistItem(typeId);
      setItems(next);
      addToast(t("banlistItemRemoved"), "success", 2000);
    } catch {
      setItems(previous);
      addToast(t("banlistRemoveItemError"), "error", 3000);
    }
  };

  const handleAddStation = async () => {
    const query = stationSearch.trim().toLowerCase();
    const selected = stationCandidates.find(
      (entry) => entry.name.toLowerCase() === query || String(entry.id) === query,
    );

    if (!selected) {
      addToast(t("banlistSelectStationPrompt"), "error", 2500);
      return;
    }

    const previous = stations;
    const optimistic = {
      location_id: selected.id,
      station_name: selected.name,
      system_id: selected.system_id,
      system_name: selected.system_name,
      added_at: new Date().toISOString(),
    };
    if (!previous.some((entry) => entry.location_id === selected.id)) {
      setStations([optimistic, ...previous]);
    }

    try {
      const result = await addBannedStation({
        location_id: selected.id,
        station_name: selected.name,
        system_id: selected.system_id,
        system_name: selected.system_name,
      });
      setStations(result.stations);
      setStationSearch("");
      addToast(
        result.inserted ? t("banlistStationAdded") : t("banlistStationAlready"),
        "success",
        2000,
      );
    } catch {
      setStations(previous);
      addToast(t("banlistAddStationError"), "error", 3000);
    }
  };

  const handleRemoveStation = async (locationId: number) => {
    const previous = stations;
    setStations(previous.filter((entry) => entry.location_id !== locationId));
    try {
      const next = await removeBannedStation(locationId);
      setStations(next);
      addToast(t("banlistStationRemoved"), "success", 2000);
    } catch {
      setStations(previous);
      addToast(t("banlistRemoveStationError"), "error", 3000);
    }
  };

  return (
    <div className="space-y-5 p-1 sm:p-2">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-eve-text">{t("banlistItemsSection")}</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 px-2.5 py-1.5 bg-eve-dark border border-eve-border rounded-sm text-sm"
            placeholder={t("banlistItemSearch")}
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            list="banlist-item-options"
            aria-label={t("banlistItemSearch")}
          />
          <button
            onClick={() => void handleAddItem()}
            className="px-3 py-1.5 rounded-sm bg-eve-panel border border-eve-border text-xs text-eve-dim hover:text-eve-accent"
          >
            {t("banlistAddItem")}
          </button>
          <datalist id="banlist-item-options">
            {filteredItemCandidates.map((item) => (
              <option key={item.type_id} value={item.type_name}>{`${item.type_name} (${item.type_id})`}</option>
            ))}
          </datalist>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-eve-dim">{t("banlistItemsEmpty")}</p>
        ) : (
          <div className="max-h-56 overflow-auto border border-eve-border rounded-sm">
            <table className="w-full text-xs">
              <thead className="bg-eve-dark/70 text-eve-dim">
                <tr>
                  <th className="text-left px-2 py-1.5">{t("colItem")}</th>
                  <th className="text-right px-2 py-1.5">ID</th>
                  <th className="text-right px-2 py-1.5">{t("watchlistAlertActions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.type_id} className="border-t border-eve-border/60">
                    <td className="px-2 py-1.5">{item.type_name}</td>
                    <td className="px-2 py-1.5 text-right text-eve-dim">{item.type_id}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => void handleRemoveItem(item.type_id)}
                        className="text-eve-error hover:underline"
                      >
                        {t("banlistRemove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-eve-text">{t("banlistStationsSection")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            className="px-2.5 py-1.5 bg-eve-dark border border-eve-border rounded-sm text-sm"
            placeholder={t("banlistStationSystemSearch")}
            value={stationSystem}
            onChange={(e) => setStationSystem(e.target.value)}
            list="banlist-system-options"
            aria-label={t("banlistStationSystemSearch")}
          />
          <input
            className="px-2.5 py-1.5 bg-eve-dark border border-eve-border rounded-sm text-sm"
            placeholder={t("banlistStationSearch")}
            value={stationSearch}
            onChange={(e) => setStationSearch(e.target.value)}
            list="banlist-station-options"
            aria-label={t("banlistStationSearch")}
          />
          <datalist id="banlist-system-options">
            {systemSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <datalist id="banlist-station-options">
            {filteredStationCandidates.map((station) => (
              <option key={station.id} value={station.name}>{`${station.name} (${station.id})`}</option>
            ))}
          </datalist>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleAddStation()}
            className="px-3 py-1.5 rounded-sm bg-eve-panel border border-eve-border text-xs text-eve-dim hover:text-eve-accent"
          >
            {t("banlistAddStation")}
          </button>
          {(systemLookupLoading || stationLookupLoading) && (
            <span className="text-xs text-eve-dim">{t("loading")}</span>
          )}
        </div>

        {stations.length === 0 ? (
          <p className="text-xs text-eve-dim">{t("banlistStationsEmpty")}</p>
        ) : (
          <div className="max-h-56 overflow-auto border border-eve-border rounded-sm">
            <table className="w-full text-xs">
              <thead className="bg-eve-dark/70 text-eve-dim">
                <tr>
                  <th className="text-left px-2 py-1.5">{t("colStation")}</th>
                  <th className="text-left px-2 py-1.5">{t("system")}</th>
                  <th className="text-right px-2 py-1.5">ID</th>
                  <th className="text-right px-2 py-1.5">{t("watchlistAlertActions")}</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((station) => (
                  <tr key={station.location_id} className="border-t border-eve-border/60">
                    <td className="px-2 py-1.5">{station.station_name}</td>
                    <td className="px-2 py-1.5 text-eve-dim">{station.system_name ?? "-"}</td>
                    <td className="px-2 py-1.5 text-right text-eve-dim">{station.location_id}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => void handleRemoveStation(station.location_id)}
                        className="text-eve-error hover:underline"
                      >
                        {t("banlistRemove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
