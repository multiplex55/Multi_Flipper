import { describe, expect, it, vi } from "vitest";
import type { UpdateCheckStatus } from "./api";
import { evaluateUpdatePoll } from "./updatePolling";

function makeStatus(overrides: Partial<UpdateCheckStatus> = {}): UpdateCheckStatus {
  return {
    current_version: "1.0.0",
    has_update: true,
    auto_update_supported: true,
    platform: "linux/amd64",
    ...overrides,
  };
}

describe("evaluateUpdatePoll", () => {
  it("does not reload on current-version mismatch alone", async () => {
    const getStatus = vi.fn<() => Promise<UpdateCheckStatus>>().mockResolvedValue(
      makeStatus({ current_version: "1.0.1", has_update: true, check_error: "" }),
    );

    const result = await evaluateUpdatePoll(getStatus, false, "");

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(result.shouldReload).toBe(false);
    expect(result.sawDisconnect).toBe(false);
  });

  it("reloads when backend reports no pending update", async () => {
    const getStatus = vi.fn<() => Promise<UpdateCheckStatus>>().mockResolvedValue(
      makeStatus({ has_update: false, check_error: "" }),
    );

    const result = await evaluateUpdatePoll(getStatus, false, "2.0.0");

    expect(result.shouldReload).toBe(true);
  });

  it("reloads when backend current version reaches apply response version", async () => {
    const getStatus = vi.fn<() => Promise<UpdateCheckStatus>>().mockResolvedValue(
      makeStatus({ current_version: "v2.0.0+build.1", has_update: true, check_error: "" }),
    );

    const result = await evaluateUpdatePoll(getStatus, false, "2.0.0");

    expect(result.shouldReload).toBe(true);
  });

  it("marks disconnect on polling failure", async () => {
    const getStatus = vi.fn<() => Promise<UpdateCheckStatus>>().mockRejectedValue(new Error("offline"));

    const result = await evaluateUpdatePoll(getStatus, false, "2.0.0");

    expect(result.shouldReload).toBe(false);
    expect(result.sawDisconnect).toBe(true);
  });
});
