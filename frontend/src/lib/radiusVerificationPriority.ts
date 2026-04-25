export type VerificationPriority = "verify_now" | "stale" | "watch" | "normal";

export interface VerificationPriorityInput {
  expectedProfitIsk?: number;
  totalJumps?: number;
  stopCount?: number;
  urgencyBand?: "stable" | "aging" | "fragile" | null;
  scanAgeMinutes?: number | null;
  staleAfterMinutes?: number;
  lensJumpDelta?: number | null;
}

export interface VerificationPriorityResult {
  priority: VerificationPriority;
  label: string;
  reason: string;
}

const DEFAULT_STALE_MINUTES = 45;

function safe(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function classifyVerificationPriority(
  input: VerificationPriorityInput,
): VerificationPriorityResult {
  const expectedProfitIsk = safe(input.expectedProfitIsk);
  const totalJumps = Math.max(safe(input.totalJumps), safe(input.stopCount) - 1, 0);
  const scanAgeMinutes = safe(input.scanAgeMinutes);
  const staleAfterMinutes = Math.max(1, safe(input.staleAfterMinutes) || DEFAULT_STALE_MINUTES);
  const lensJumpDelta = Math.abs(safe(input.lensJumpDelta));
  const urgencyBand = input.urgencyBand ?? "stable";
  const highProfit = expectedProfitIsk >= 25_000_000;
  const longJump = totalJumps >= 10 || lensJumpDelta >= 3;
  const fragile = urgencyBand === "fragile" || urgencyBand === "aging";

  if (scanAgeMinutes >= staleAfterMinutes) {
    return {
      priority: "stale",
      label: "Stale",
      reason: `Market snapshot is ${scanAgeMinutes.toFixed(0)}m old.`,
    };
  }
  if (highProfit && longJump && fragile) {
    return {
      priority: "verify_now",
      label: "Verify now",
      reason: "High profit + long route + fragile timing.",
    };
  }
  if (highProfit || longJump || fragile || lensJumpDelta >= 2) {
    return {
      priority: "watch",
      label: "Watch",
      reason: "Route has moderate verification risk signals.",
    };
  }
  return {
    priority: "normal",
    label: "Normal",
    reason: "Route appears stable and local.",
  };
}

export function verificationPriorityChipClass(priority: VerificationPriority): string {
  switch (priority) {
    case "verify_now":
      return "border-rose-500/60 text-rose-200 bg-rose-500/10";
    case "stale":
      return "border-amber-500/60 text-amber-200 bg-amber-500/10";
    case "watch":
      return "border-indigo-400/60 text-indigo-200 bg-indigo-500/10";
    default:
      return "border-emerald-500/60 text-emerald-200 bg-emerald-500/10";
  }
}
