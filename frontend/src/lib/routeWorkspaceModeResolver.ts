import type { RouteWorkspaceIntent } from "@/lib/routeHandoff";

const MODE_STORAGE_KEY = "eve:route-workspace:mode:v1";
export type RouteWorkspaceMode = "discover" | "finder" | "workbench" | "validate";

export type PersistedRouteWorkspaceMode = {
  mode: Extract<RouteWorkspaceMode, "finder" | "workbench" | "validate">;
  hadActiveRouteAtPersistTime: boolean;
  persistedAt: number;
};

export type RouteWorkspaceResolverInput = {
  explicitIntent?: RouteWorkspaceIntent | null;
  openedFromRadiusOrSavedRoute?: boolean;
  hasActiveRoute: boolean;
  hasSelectedOrSavedPack: boolean;
  persistedMode?: PersistedRouteWorkspaceMode | null;
};

export function canUseModeInCurrentContext(
  mode: RouteWorkspaceMode,
  hasRouteContext: boolean,
): boolean {
  if (mode === "workbench" || mode === "validate") return hasRouteContext;
  return true;
}

export function resolveRouteWorkspaceMode(
  input: RouteWorkspaceResolverInput,
): Extract<RouteWorkspaceMode, "finder" | "workbench" | "validate"> {
  if (input.explicitIntent === "open-validate") return "validate";
  if (input.explicitIntent === "open-workbench") return "workbench";
  if (input.explicitIntent === "finder") return "finder";

  if (!input.openedFromRadiusOrSavedRoute && !input.hasSelectedOrSavedPack) {
    return "finder";
  }

  if (input.openedFromRadiusOrSavedRoute) {
    return "workbench";
  }

  const persisted = input.persistedMode;
  if (
    persisted &&
    canUseModeInCurrentContext(persisted.mode, input.hasActiveRoute) &&
    (persisted.mode === "finder" || persisted.hadActiveRouteAtPersistTime)
  ) {
    return persisted.mode;
  }

  return input.hasActiveRoute ? "workbench" : "finder";
}

function parsePersistedMode(raw: string | null): PersistedRouteWorkspaceMode | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedRouteWorkspaceMode>;
    if (parsed.mode !== "finder" && parsed.mode !== "workbench" && parsed.mode !== "validate") {
      return null;
    }
    return {
      mode: parsed.mode,
      hadActiveRouteAtPersistTime: !!parsed.hadActiveRouteAtPersistTime,
      persistedAt: Number.isFinite(parsed.persistedAt) ? Number(parsed.persistedAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

function getStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  if (typeof window === "undefined") return null;
  return window.localStorage ?? window.sessionStorage ?? null;
}

export function loadPersistedRouteWorkspaceMode(): PersistedRouteWorkspaceMode | null {
  const storage = getStorage();
  if (!storage) return null;
  return parsePersistedMode(storage.getItem(MODE_STORAGE_KEY));
}

export function persistRouteWorkspaceMode(input: {
  mode: Extract<RouteWorkspaceMode, "finder" | "workbench" | "validate">;
  hadActiveRouteAtPersistTime: boolean;
}): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      MODE_STORAGE_KEY,
      JSON.stringify({ ...input, persistedAt: Date.now() } satisfies PersistedRouteWorkspaceMode),
    );
  } catch {
    // ignore storage write errors
  }
}

export function clearPersistedRouteWorkspaceMode(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(MODE_STORAGE_KEY);
  } catch {
    // ignore storage clear errors
  }
}

export { MODE_STORAGE_KEY as ROUTE_WORKSPACE_MODE_STORAGE_KEY };
