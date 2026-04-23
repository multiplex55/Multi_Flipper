import { describe, expect, it } from "vitest";
import { resolveRouteWorkspaceMode } from "@/lib/routeWorkspaceModeResolver";

describe("resolveRouteWorkspaceMode", () => {
  it("returns finder with no handoff and no selected/saved route context", () => {
    const mode = resolveRouteWorkspaceMode({
      hasActiveRoute: false,
      hasSelectedOrSavedPack: false,
      openedFromRadiusOrSavedRoute: false,
    });
    expect(mode).toBe("finder");
  });

  it("returns workbench when opened from radius/saved routes", () => {
    const mode = resolveRouteWorkspaceMode({
      hasActiveRoute: true,
      hasSelectedOrSavedPack: true,
      openedFromRadiusOrSavedRoute: true,
    });
    expect(mode).toBe("workbench");
  });

  it("returns validate for explicit validate intent", () => {
    const mode = resolveRouteWorkspaceMode({
      explicitIntent: "open-validate",
      hasActiveRoute: true,
      hasSelectedOrSavedPack: true,
      openedFromRadiusOrSavedRoute: false,
    });
    expect(mode).toBe("validate");
  });

  it("ignores stale persisted workbench mode when active route is absent", () => {
    const mode = resolveRouteWorkspaceMode({
      hasActiveRoute: false,
      hasSelectedOrSavedPack: true,
      openedFromRadiusOrSavedRoute: false,
      persistedMode: {
        mode: "workbench",
        hadActiveRouteAtPersistTime: true,
        persistedAt: Date.now(),
      },
    });
    expect(mode).toBe("finder");
  });
});
