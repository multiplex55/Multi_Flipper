import { useMemo, useState } from "react";
import {
  getRadiusVerificationBadgeMeta,
  getVerifyActionLabel,
  type RadiusVerificationState,
  dedupeVerificationTargets,
} from "@/lib/radiusVerificationStatus";
import { getVerificationFreshness, getVerificationProfileById } from "@/lib/verificationProfiles";
import {
  getNextQueuedRoute,
  removeRouteQueueEntry,
  type RouteQueueEntry,
  type RouteQueueStatus,
  updateRouteQueueEntry,
} from "@/lib/routeQueue";

type RouteQueuePanelProps = {
  entries: RouteQueueEntry[];
  onChange: (entries: RouteQueueEntry[]) => void;
  onOpenWorkbench?: (routeKey: string) => void;
  onOpenBatchBuilder?: (routeKey: string) => void;
  onVerifyRoute?: (routeKey: string) => void;
};

const STATUS_ORDER: RouteQueueStatus[] = [
  "needs_verify",
  "assigned",
  "queued",
  "buying",
  "hauling",
  "selling",
  "skipped",
  "done",
];

function statusLabel(status: RouteQueueStatus): string {
  return status.replace("_", " ");
}

function queueVerificationState(entry: RouteQueueEntry): RadiusVerificationState {
  if (!entry.lastVerifiedAt) return "unverified";
  if (entry.status === "needs_verify") return "stale";
  const freshness = getVerificationFreshness(
    entry.lastVerifiedAt,
    getVerificationProfileById(entry.verificationProfileId),
  );
  return freshness === "stale" ? "stale" : "fresh";
}

export function RouteQueuePanel({
  entries,
  onChange,
  onOpenWorkbench,
  onOpenBatchBuilder,
  onVerifyRoute,
}: RouteQueuePanelProps) {
  const [showDone, setShowDone] = useState(false);
  const visibleEntries = useMemo(
    () => (showDone ? entries : entries.filter((entry) => entry.status !== "done" && entry.status !== "skipped")),
    [entries, showDone],
  );
  const nextRoute = useMemo(() => getNextQueuedRoute(entries), [entries]);

  const verifyByFilter = (filter: (entry: RouteQueueEntry) => boolean) => {
    if (!onVerifyRoute) return;
    const targets = dedupeVerificationTargets(entries.filter(filter).map((entry) => ({ routeKey: entry.routeKey })));
    for (const target of targets) onVerifyRoute(target.routeKey);
  };

  const promote = (entry: RouteQueueEntry, delta: number) => {
    onChange(
      updateRouteQueueEntry(entries, entry.routeKey, {
        priority: entry.priority + delta,
      }),
    );
  };

  const setStatus = (entry: RouteQueueEntry, status: RouteQueueStatus) => {
    onChange(
      updateRouteQueueEntry(entries, entry.routeKey, {
        status,
        lastVerifiedAt: status === "needs_verify" ? entry.lastVerifiedAt : status === "assigned" ? entry.lastVerifiedAt : new Date().toISOString(),
      }),
    );
  };

  return (
    <section className="rounded-sm border border-indigo-400/40 bg-indigo-500/5 p-2 text-xs" data-testid="route-queue-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-indigo-200">Route queue ({entries.length})</div>
          <div className="text-eve-dim" data-testid="route-queue-next-action">
            Next action: {nextRoute ? `${nextRoute.routeLabel} (${statusLabel(nextRoute.status)})` : "No queued route"}
          </div>
        </div>
        <label className="inline-flex items-center gap-1 text-eve-dim">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(event) => setShowDone(event.target.checked)}
          />
          Show done
        </label>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="rounded-sm border border-amber-400/60 px-1 py-0.5 text-amber-200" onClick={() => verifyByFilter((entry) => entry.status === "queued")}>Verify queued</button>
          <button type="button" className="rounded-sm border border-amber-400/60 px-1 py-0.5 text-amber-200" onClick={() => verifyByFilter((entry) => entry.status === "assigned")}>Verify assigned</button>
          <button type="button" className="rounded-sm border border-amber-400/60 px-1 py-0.5 text-amber-200" onClick={() => verifyByFilter((entry) => queueVerificationState(entry) === "stale")}>Verify stale</button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {visibleEntries.length === 0 ? (
          <div className="text-eve-dim">No queued routes.</div>
        ) : (
          visibleEntries.map((entry) => (
            <div key={entry.routeKey} className="rounded-sm border border-indigo-300/30 bg-eve-panel/40 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-eve-text">{entry.routeLabel}</div>
                  <div className="text-eve-dim">{entry.routeKey}</div>
                </div>
                <div className="text-eve-dim">Priority {entry.priority} · {statusLabel(entry.status)}</div>
                <span className={`rounded-sm border px-1 py-0 text-[10px] ${getRadiusVerificationBadgeMeta(queueVerificationState(entry)).className}`}>
                  {getRadiusVerificationBadgeMeta(queueVerificationState(entry)).label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => promote(entry, 1)}>Promote</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => promote(entry, -1)}>Demote</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => setStatus(entry, "assigned")}>Assign</button>
                <button
                  type="button"
                  className="rounded-sm border border-amber-400/60 px-1 py-0.5 text-amber-200"
                  onClick={() => {
                    onVerifyRoute?.(entry.routeKey);
                    setStatus(entry, "queued");
                  }}
                >
                  {getVerifyActionLabel(queueVerificationState(entry))}
                </button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => onOpenWorkbench?.(entry.routeKey)}>Open Workbench</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => onOpenBatchBuilder?.(entry.routeKey)}>Open Batch Builder</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => setStatus(entry, "buying")}>Mark Buying</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => setStatus(entry, "hauling")}>Mark Hauling</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => setStatus(entry, "selling")}>Mark Selling</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => setStatus(entry, "done")}>Mark Done</button>
                <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => setStatus(entry, "skipped")}>Skip</button>
                <button
                  type="button"
                  className="rounded-sm border border-rose-500/40 px-1 py-0.5 text-rose-200"
                  onClick={() => onChange(removeRouteQueueEntry(entries, entry.routeKey))}
                >
                  Remove
                </button>
              </div>
              <div className="sr-only">Status order: {STATUS_ORDER.join(",")}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
