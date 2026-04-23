export type VerificationProfile = {
  id: string;
  name: string;
  maxBuyDriftPct: number;
  maxSellDriftPct: number;
  minProfitRetentionPct: number;
  maxAgeMinutes?: number;
  minFillPct?: number;
  minExecutionScore?: number;
};

export type VerificationRecommendation =
  | "proceed"
  | "proceed_reduced"
  | "reprice_rebuild"
  | "abort";

export type VerificationDecisionThresholds = {
  proceedMinProfitRetentionPct: number;
  proceedMaxBuyDriftPct: number;
  proceedMaxSellDriftPct: number;
  proceedReducedMinProfitRetentionPct: number;
  repriceRebuildMinProfitRetentionPct: number;
  repriceRebuildMaxBuyDriftPct: number;
  repriceRebuildMaxSellDriftPct: number;
};

export type VerificationFreshness = "fresh" | "aging" | "stale";

export const verificationProfiles: VerificationProfile[] = [
  {
    id: "strict",
    name: "Strict",
    maxBuyDriftPct: 3,
    maxSellDriftPct: 3,
    minProfitRetentionPct: 85,
    maxAgeMinutes: 60,
    minFillPct: 85,
    minExecutionScore: 75,
  },
  {
    id: "standard",
    name: "Standard",
    maxBuyDriftPct: 5,
    maxSellDriftPct: 5,
    minProfitRetentionPct: 70,
    maxAgeMinutes: 180,
    minFillPct: 65,
    minExecutionScore: 60,
  },
  {
    id: "aggressive",
    name: "Aggressive",
    maxBuyDriftPct: 12,
    maxSellDriftPct: 12,
    minProfitRetentionPct: 40,
    maxAgeMinutes: 720,
    minFillPct: 40,
    minExecutionScore: 40,
  },
];

export const DEFAULT_VERIFICATION_PROFILE_ID = "standard";

export function getVerificationProfileById(
  profileId?: string | null,
): VerificationProfile {
  if (!profileId) {
    return (
      verificationProfiles.find((profile) => profile.id === DEFAULT_VERIFICATION_PROFILE_ID) ??
      verificationProfiles[0]
    );
  }
  return (
    verificationProfiles.find((profile) => profile.id === profileId) ??
    getVerificationProfileById(DEFAULT_VERIFICATION_PROFILE_ID)
  );
}

export function getVerificationFreshness(
  lastVerifiedAt: string | null,
  profile: VerificationProfile,
  now: Date = new Date(),
): VerificationFreshness {
  if (!lastVerifiedAt) return "stale";
  const parsed = new Date(lastVerifiedAt);
  if (!Number.isFinite(parsed.getTime())) return "stale";
  const ageMs = Math.max(0, now.getTime() - parsed.getTime());
  const maxAgeMinutes = profile.maxAgeMinutes ?? getVerificationProfileById().maxAgeMinutes ?? 180;
  const maxAgeMs = maxAgeMinutes * 60_000;
  if (ageMs > maxAgeMs) return "stale";
  if (ageMs > maxAgeMs * 0.5) return "aging";
  return "fresh";
}

export function getVerificationDecisionThresholds(
  profile: VerificationProfile,
): VerificationDecisionThresholds {
  return {
    proceedMinProfitRetentionPct: Math.max(0, Math.min(100, profile.minProfitRetentionPct + 20)),
    proceedMaxBuyDriftPct: profile.maxBuyDriftPct * 0.5,
    proceedMaxSellDriftPct: profile.maxSellDriftPct * 0.5,
    proceedReducedMinProfitRetentionPct: profile.minProfitRetentionPct,
    repriceRebuildMinProfitRetentionPct: Math.max(0, profile.minProfitRetentionPct * 0.8),
    repriceRebuildMaxBuyDriftPct: profile.maxBuyDriftPct,
    repriceRebuildMaxSellDriftPct: profile.maxSellDriftPct,
  };
}
