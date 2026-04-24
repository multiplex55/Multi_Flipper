import type { SavedRoutePack } from "@/lib/types";
import type { RouteAssignment } from "@/lib/routeAssignments";
import { formatISK } from "@/lib/format";

interface SavedRoutePacksPanelProps {
  packs: SavedRoutePack[];
  onOpen: (
    pack: SavedRoutePack,
    mode?: "summary" | "execution" | "filler" | "verification",
  ) => void;
  onVerify: (pack: SavedRoutePack) => void;
  onVerificationProfileChange: (pack: SavedRoutePack, profileId: string) => void;
  onCopy: (pack: SavedRoutePack) => void;
  onRemove: (pack: SavedRoutePack) => void;
  onMarkBought: (pack: SavedRoutePack, lineKey: string, qty: number) => void;
  onMarkSold: (pack: SavedRoutePack, lineKey: string, qty: number) => void;
  onMarkSkipped: (pack: SavedRoutePack, lineKey: string, reason: string) => void;
  onResetLine: (pack: SavedRoutePack, lineKey: string) => void;
  assignmentByRouteKey?: Record<string, RouteAssignment | undefined>;
}

function verificationAge(lastVerifiedAt: string | null): string {
  if (!lastVerifiedAt) return "—";
  const deltaMs = Date.now() - new Date(lastVerifiedAt).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return "—";
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function SavedRoutePacksPanel({
  packs,
  onOpen,
  onVerify,
  onVerificationProfileChange,
  onCopy,
  onRemove,
  assignmentByRouteKey = {},
}: SavedRoutePacksPanelProps) {
  return (
    <div className="border border-eve-border rounded-sm p-2 mb-2 bg-eve-panel/40" data-testid="saved-route-packs-panel">
      <div className="text-xs uppercase tracking-wide text-eve-dim mb-2">Saved routes</div>
      {packs.length === 0 ? (
        <div className="text-xs text-eve-dim">No saved routes yet.</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-eve-dim text-left border-b border-eve-border/60">
                <th className="py-1 pr-2">Route</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Expected profit</th>
                <th className="py-1 pr-2">Verification</th>
                <th className="py-1 pr-2">Last verified</th>
                <th className="py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.routeKey} className="border-b border-eve-border/40 last:border-b-0 align-top">
                  <td className="py-1 pr-2 text-eve-text">{pack.routeLabel}</td>
                  <td className="py-1 pr-2">{pack.status}{assignmentByRouteKey[pack.routeKey] ? ` · ${assignmentByRouteKey[pack.routeKey]?.assignedCharacterName} (${assignmentByRouteKey[pack.routeKey]?.status})` : ""}</td>
                  <td className="py-1 pr-2 font-mono">{formatISK(pack.summarySnapshot.routeTotalProfit)}</td>
                  <td className="py-1 pr-2">{pack.verificationSnapshot?.status ?? "Unverified"}</td>
                  <td className="py-1 pr-2">{verificationAge(pack.lastVerifiedAt)}</td>
                  <td className="py-1">
                    <div className="inline-flex flex-wrap gap-1">
                      <button type="button" onClick={() => onOpen(pack, "summary")} className="border border-eve-border/60 px-1.5 py-0.5 rounded-sm" aria-label={`Open ${pack.routeLabel} summary`}>Open</button>
                      <button type="button" onClick={() => onOpen(pack, "execution")} className="border border-eve-border/60 px-1.5 py-0.5 rounded-sm" aria-label={`Open ${pack.routeLabel} execution`}>Execution</button>
                      <button type="button" onClick={() => onOpen(pack, "verification")} className="border border-eve-border/60 px-1.5 py-0.5 rounded-sm" aria-label={`Open ${pack.routeLabel} verification`}>Verification</button>
                      <button type="button" onClick={() => onVerify(pack)} className="border border-eve-border/60 px-1.5 py-0.5 rounded-sm">Verify</button>
                      <button type="button" onClick={() => onVerificationProfileChange(pack, "standard")} className="border border-eve-border/60 px-1.5 py-0.5 rounded-sm">Std Profile</button>
                      <button type="button" onClick={() => onCopy(pack)} className="border border-eve-border/60 px-1.5 py-0.5 rounded-sm">Copy</button>
                      <button type="button" onClick={() => onRemove(pack)} className="border border-rose-500/50 text-rose-200 px-1.5 py-0.5 rounded-sm">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
