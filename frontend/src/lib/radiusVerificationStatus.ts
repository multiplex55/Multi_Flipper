import type { FlipResult, SavedRoutePackVerificationSnapshot } from "@/lib/types";
import type { VerificationPriority } from "@/lib/radiusVerificationPriority";
import { getVerificationFreshness, getVerificationProfileById } from "@/lib/verificationProfiles";

export type RadiusVerificationState = "unverified" | "fresh" | "stale" | "reduced_edge" | "abort";

export type RadiusVerificationTone = "neutral" | "good" | "warn" | "reduced" | "abort";

export type RadiusVerificationBadgeMeta = {
  label: "Unverified" | "Fresh" | "Needs Verify" | "Profit Reduced" | "Abort";
  tone: RadiusVerificationTone;
  className: string;
};

const VERIFICATION_STATE_META: Record<RadiusVerificationState, RadiusVerificationBadgeMeta> = {
  unverified: {
    label: "Unverified",
    tone: "neutral",
    className: "border-slate-400/40 text-slate-200 bg-slate-500/10",
  },
  fresh: {
    label: "Fresh",
    tone: "good",
    className: "border-emerald-500/60 text-emerald-200 bg-emerald-500/10",
  },
  stale: {
    label: "Needs Verify",
    tone: "warn",
    className: "border-amber-500/70 text-amber-200 bg-amber-500/10",
  },
  reduced_edge: {
    label: "Profit Reduced",
    tone: "reduced",
    className: "border-orange-500/70 text-orange-200 bg-orange-500/10",
  },
  abort: {
    label: "Abort",
    tone: "abort",
    className: "border-rose-500/70 text-rose-200 bg-rose-500/15",
  },
};

export function getRadiusVerificationBadgeMeta(state: RadiusVerificationState): RadiusVerificationBadgeMeta {
  return VERIFICATION_STATE_META[state];
}

export function verificationStateFromPriority(priority: VerificationPriority): RadiusVerificationState {
  return priority === "stale" ? "stale" : "fresh";
}

export function verificationStateFromSnapshot(input: {
  snapshot?: SavedRoutePackVerificationSnapshot | null;
  lastVerifiedAt?: string | null;
  verificationProfileId?: string | null;
}): RadiusVerificationState {
  const snapshot = input.snapshot;
  if (!snapshot) return "unverified";
  const recommendation = snapshot.recommendation;
  if (recommendation === "abort" || snapshot.status === "Abort") return "abort";
  if (recommendation === "proceed_reduced" || recommendation === "reprice_rebuild" || snapshot.status === "Reduced edge") {
    return "reduced_edge";
  }
  const freshness = getVerificationFreshness(
    input.lastVerifiedAt ?? snapshot.checkedAt ?? snapshot.verifiedAt,
    getVerificationProfileById(input.verificationProfileId),
  );
  return freshness === "stale" ? "stale" : "fresh";
}

export function getVerifyActionLabel(state: RadiusVerificationState): string {
  switch (state) {
    case "abort":
      return "Re-verify abort";
    case "reduced_edge":
    case "stale":
      return "Verify now";
    case "fresh":
      return "Re-verify";
    default:
      return "Verify";
  }
}

export type RadiusVerificationTarget = {
  routeKey: string;
  itemIdentity?: string;
};

export function routeItemIdentity(row: Pick<FlipResult, "TypeID" | "BuyLocationID" | "SellLocationID">): string {
  return `${Math.trunc(row.TypeID)}:${Math.trunc(row.BuyLocationID ?? 0)}:${Math.trunc(row.SellLocationID ?? 0)}`;
}

export function dedupeVerificationTargets<T extends RadiusVerificationTarget>(targets: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const target of targets) {
    const identity = `${target.routeKey}::${target.itemIdentity ?? "route"}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(target);
  }
  return deduped;
}
