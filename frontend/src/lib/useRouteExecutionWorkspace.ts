import { useCallback, useMemo, useState } from "react";
import type { SavedRoutePack } from "@/lib/types";
import {
  formatSavedRoutePackExport,
  loadSavedRoutePacks,
  removeSavedRoutePack,
  upsertSavedRoutePack,
} from "@/lib/savedRoutePacks";
import {
  markLineBought,
  markLineSkipped,
  markLineSold,
  resetLineState,
} from "@/lib/savedRouteExecution";
import {
  DEFAULT_VERIFICATION_PROFILE_ID,
  getVerificationProfileById,
} from "@/lib/verificationProfiles";
import type { RouteVerificationResult } from "@/lib/routeManifestVerification";

export type RouteExecutionWorkspaceMode = "finder" | "workbench" | "validate";

export interface RouteExecutionWorkspace {
  activeRouteKey: string | null;
  activeMode: RouteExecutionWorkspaceMode;
  savedRoutePacks: SavedRoutePack[];
  selectedPack: SavedRoutePack | null;
  getPackByRouteKey: (routeKey: string) => SavedRoutePack | null;
  getVerificationProfileId: (routeKey: string) => string;
  openRoute: (routeKey: string, mode?: RouteExecutionWorkspaceMode) => void;
  setMode: (mode: RouteExecutionWorkspaceMode) => void;
  selectPack: (routeKey: string | null) => void;
  upsertPack: (pack: SavedRoutePack) => void;
  removePack: (routeKey: string) => void;
  verifyRoute: (
    routeKey: string,
    input: {
      profileId?: string;
      result: RouteVerificationResult;
      rebuildPack?: (existing: SavedRoutePack | null, profileId: string) => SavedRoutePack | null;
    },
  ) => void;
  markBought: (routeKey: string, lineKey: string, qty: number, totalCost: number) => void;
  markSold: (routeKey: string, lineKey: string, qty: number, totalRevenue: number) => void;
  markSkipped: (routeKey: string, lineKey: string, reason: string) => void;
  resetExecution: (routeKey: string, lineKey?: string) => void;
  copySummary: (routeKey: string) => string;
  copyManifest: (routeKey: string) => string;
  openBatchBuilder: (routeKey: string) => void;
}

export function useRouteExecutionWorkspace(options?: {
  initialMode?: RouteExecutionWorkspaceMode;
  writeClipboard?: (text: string) => void | Promise<void>;
  onOpenBatchBuilder?: (routeKey: string) => void;
}): RouteExecutionWorkspace {
  const [activeRouteKey, setActiveRouteKey] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<RouteExecutionWorkspaceMode>(
    options?.initialMode ?? "finder",
  );
  const [savedRoutePacks, setSavedRoutePacks] = useState<SavedRoutePack[]>(() =>
    loadSavedRoutePacks(),
  );
  const [verificationProfileByRouteKey, setVerificationProfileByRouteKey] =
    useState<Record<string, string>>({});

  const savedRoutePackByKey = useMemo(() => {
    const out: Record<string, SavedRoutePack> = {};
    for (const pack of savedRoutePacks) out[pack.routeKey] = pack;
    return out;
  }, [savedRoutePacks]);

  const getVerificationProfileId = useCallback(
    (routeKey: string) =>
      verificationProfileByRouteKey[routeKey] ??
      savedRoutePackByKey[routeKey]?.verificationProfileId ??
      DEFAULT_VERIFICATION_PROFILE_ID,
    [savedRoutePackByKey, verificationProfileByRouteKey],
  );

  const selectedPack = activeRouteKey ? savedRoutePackByKey[activeRouteKey] ?? null : null;

  const getPackByRouteKey = useCallback(
    (routeKey: string) => savedRoutePackByKey[routeKey] ?? null,
    [savedRoutePackByKey],
  );

  const setMode = useCallback((mode: RouteExecutionWorkspaceMode) => {
    setActiveMode(mode);
  }, []);

  const openRoute = useCallback(
    (routeKey: string, mode: RouteExecutionWorkspaceMode = "workbench") => {
      setActiveRouteKey(routeKey);
      setActiveMode(mode);
    },
    [],
  );

  const selectPack = useCallback((routeKey: string | null) => {
    setActiveRouteKey(routeKey);
    if (routeKey) setActiveMode("workbench");
  }, []);

  const upsertPack = useCallback((pack: SavedRoutePack) => {
    setSavedRoutePacks(upsertSavedRoutePack(pack));
    setVerificationProfileByRouteKey((prev) => ({
      ...prev,
      [pack.routeKey]: pack.verificationProfileId ?? DEFAULT_VERIFICATION_PROFILE_ID,
    }));
  }, []);

  const removePackByKey = useCallback((routeKey: string) => {
    setSavedRoutePacks(removeSavedRoutePack(routeKey));
  }, []);

  const verifyRoute = useCallback(
    (
      routeKey: string,
      input: {
        profileId?: string;
        result: RouteVerificationResult;
        rebuildPack?: (existing: SavedRoutePack | null, profileId: string) => SavedRoutePack | null;
      },
    ) => {
      const profileId = getVerificationProfileById(input.profileId).id;
      setVerificationProfileByRouteKey((prev) => ({ ...prev, [routeKey]: profileId }));
      const rebuilt = input.rebuildPack?.(savedRoutePackByKey[routeKey] ?? null, profileId);
      if (rebuilt) {
        const withVerification: SavedRoutePack = {
          ...rebuilt,
          verificationProfileId: profileId,
        };
        setSavedRoutePacks(upsertSavedRoutePack(withVerification));
      }
      setActiveRouteKey(routeKey);
      setActiveMode("validate");
    },
    [savedRoutePackByKey, setSavedRoutePacks, getVerificationProfileById],
  );

  const mutatePack = useCallback(
    (routeKey: string, mutate: (pack: SavedRoutePack) => SavedRoutePack) => {
      setSavedRoutePacks((prev) => {
        const pack = prev.find((item) => item.routeKey === routeKey);
        if (!pack) return prev;
        return upsertSavedRoutePack(mutate(pack));
      });
    },
    [],
  );

  const markBought = useCallback(
    (routeKey: string, lineKey: string, qty: number, totalCost: number) => {
      mutatePack(routeKey, (pack) => markLineBought(pack, routeKey, lineKey, qty, totalCost));
    },
    [mutatePack],
  );
  const markSold = useCallback(
    (routeKey: string, lineKey: string, qty: number, totalRevenue: number) => {
      mutatePack(routeKey, (pack) => markLineSold(pack, routeKey, lineKey, qty, totalRevenue));
    },
    [mutatePack],
  );
  const markSkipped = useCallback(
    (routeKey: string, lineKey: string, reason: string) => {
      mutatePack(routeKey, (pack) => markLineSkipped(pack, routeKey, lineKey, reason));
    },
    [mutatePack],
  );

  const resetExecution = useCallback(
    (routeKey: string, lineKey?: string) => {
      if (lineKey) {
        mutatePack(routeKey, (pack) => resetLineState(pack, routeKey, lineKey));
        return;
      }
      mutatePack(routeKey, (pack) => {
        let current = pack;
        for (const key of Object.keys(pack.lines)) {
          current = resetLineState(current, routeKey, key);
        }
        return current;
      });
    },
    [mutatePack],
  );

  const writeClipboard = options?.writeClipboard ?? ((text: string) => navigator.clipboard.writeText(text));

  const copySummary = useCallback(
    (routeKey: string) => {
      const pack = savedRoutePackByKey[routeKey];
      if (!pack) return "";
      const payload = formatSavedRoutePackExport(pack);
      void writeClipboard(payload);
      return payload;
    },
    [savedRoutePackByKey, writeClipboard],
  );

  const copyManifest = useCallback(
    (routeKey: string) => {
      const pack = savedRoutePackByKey[routeKey];
      if (!pack?.manifestSnapshot) return "";
      const payload = [
        `Route: ${pack.routeLabel}`,
        `Expected profit: ${pack.manifestSnapshot.expected_profit_isk}`,
        `Min acceptable: ${pack.manifestSnapshot.min_acceptable_profit_isk}`,
      ].join("\n");
      void writeClipboard(payload);
      return payload;
    },
    [savedRoutePackByKey, writeClipboard],
  );

  const openBatchBuilder = useCallback(
    (routeKey: string) => {
      setActiveRouteKey(routeKey);
      setActiveMode("workbench");
      options?.onOpenBatchBuilder?.(routeKey);
    },
    [options],
  );

  return {
    activeRouteKey,
    activeMode,
    savedRoutePacks,
    selectedPack,
    getPackByRouteKey,
    getVerificationProfileId,
    openRoute,
    setMode,
    selectPack,
    upsertPack,
    removePack: removePackByKey,
    verifyRoute,
    markBought,
    markSold,
    markSkipped,
    resetExecution,
    copySummary,
    copyManifest,
    openBatchBuilder,
  };
}
