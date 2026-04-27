import { ActionButton, ControlGroup, MutedLabel } from "@/components/ui/ControlPrimitives";

type RadiusWorkflowHelpDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const HELP_SECTIONS: Array<{ title: string; bullets: string[] }> = [
  {
    title: "Recommended workflow",
    bullets: [
      "Scan, sort by route quality, and verify execution-ready picks before committing capital.",
      "Move top routes into queue, assign pilots, then finalize cargo from the workbench.",
    ],
  },
  {
    title: "Finding trades",
    bullets: [
      "Use Filters + column sorting to remove thin, stale, or low-turnover opportunities.",
      "Start with route packs that combine strong profit with manageable jump count.",
    ],
  },
  {
    title: "Reading best-deal cards",
    bullets: [
      "Title and route label identify what the card optimizes (speed, cargo use, safety, etc.).",
      "Compare expected profit, ISK/jump, and urgency cues before opening a batch.",
    ],
  },
  {
    title: "Cargo builds",
    bullets: [
      "Open Batch to lock the primary route composition first in Flipper (Radius).",
      "Use Flipper Radius (Route) > Workbench for cargo refill when remaining m³ needs fillers.",
    ],
  },
  {
    title: "Queue + pilot assignment",
    bullets: [
      "Queue and assign routes from Flipper Radius (Route) so pilots run highest-confidence batches first.",
      "Keep route ownership clear in the Route tab to avoid duplicate buys across characters.",
    ],
  },
  {
    title: "Price verification before undock",
    bullets: [
      "Run Verify Prices in Flipper Radius (Route) immediately before departure on high-value or fragile routes.",
      "Abort or rebuild if spread, fill depth, or destination demand changed materially.",
    ],
  },
  {
    title: "Bad trade signals",
    bullets: [
      "Aging scans, shrinking margins, and low fill confidence are warning signs.",
      "Large jump count with weak ISK/jump usually means better alternatives exist.",
    ],
  },
  {
    title: "High-value columns",
    bullets: [
      "Prioritize Real ISK/Jump, Daily ISK/Jump, Turnover Days, and slippage cost fields.",
      "Use Route Pack execution-quality columns to spot fragile or concentrated profits.",
    ],
  },
];

export function RadiusWorkflowHelpDrawer({ open, onClose }: RadiusWorkflowHelpDrawerProps) {
  if (!open) return null;

  return (
    <div className="shrink-0 px-2 pb-1" data-testid="radius-workflow-help-drawer">
      <div className="rounded-sm border border-eve-border/70 bg-eve-dark/30">
        <div className="flex items-center justify-between border-b border-eve-border/50 px-2 py-1">
          <MutedLabel className="uppercase tracking-wider">How to use Radius</MutedLabel>
          <ControlGroup zone="analysis">
            <ActionButton size="xs" onClick={onClose}>
              Close
            </ActionButton>
          </ControlGroup>
        </div>
        <div className="grid gap-2 px-2 py-2 text-[11px] text-eve-text">
          {HELP_SECTIONS.map((section) => (
            <section key={section.title}>
              <h4 className="text-[10px] uppercase tracking-wider text-eve-dim">{section.title}</h4>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-eve-text/90">
                {section.bullets.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
