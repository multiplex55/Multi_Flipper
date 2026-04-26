import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { radiusColumnGuideRows } from "@/lib/radiusColumnGuide";
import { radiusColumnPresets } from "@/lib/radiusColumnPresets";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RadiusColumnGuideModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const groupedGuideRows = useMemo(
    () =>
      Object.entries(
        radiusColumnGuideRows.reduce<Record<string, typeof radiusColumnGuideRows>>((acc, row) => {
          if (!acc[row.category]) acc[row.category] = [];
          acc[row.category].push(row);
          return acc;
        }, {}),
      ),
    [],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("radiusGuideModalTitle")}
      width="max-w-4xl"
    >
      <div className="p-4 sm:p-5 space-y-4" aria-label="radius-column-guide-content">
        <p className="text-sm text-eve-dim">{t("radiusGuideModalIntro")}</p>
        <section className="rounded-sm border border-eve-border bg-eve-dark/20 p-3 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-eve-dim">
            Workflow presets
          </h2>
          <p className="text-xs text-eve-dim">
            Presets are optimized starting layouts for different execution intents. Apply one from Decision mode, then save layout if you want to keep it.
          </p>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="radius-column-guide-presets">
            {radiusColumnPresets.map((preset) => (
              <article key={preset.id} className="rounded-sm border border-eve-border/70 bg-eve-panel/40 p-2">
                <h3 className="text-xs font-semibold text-eve-accent">{preset.label}</h3>
                <p className="text-[11px] text-eve-dim">{preset.description}</p>
              </article>
            ))}
          </div>
        </section>
        <div
          className="max-h-[60vh] overflow-y-auto space-y-3 pr-1"
          data-testid="radius-column-guide-scroll"
        >
          {groupedGuideRows.map(([category, rows]) => (
            <section key={category} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-eve-dim">{category}</h2>
              <div className="space-y-3">
                {rows.map((row) => (
                  <section
                    key={row.columnKey}
                    className="rounded-sm border border-eve-border bg-eve-panel/40 p-3 space-y-2"
                    aria-label={`${row.title} guide`}
                  >
                    <h3 className="text-sm font-semibold text-eve-accent">
                      {row.title}
                      <span className="ml-2 text-[10px] uppercase text-eve-dim">({row.applicability})</span>
                    </h3>
                    <p className="text-xs text-eve-text">
                      <span className="font-semibold">{t("radiusGuideSectionWhatItIs")}: </span>
                      {row.whatItIs}
                    </p>
                    <p className="text-xs text-eve-text">
                      <span className="font-semibold">{t("radiusGuideSectionWhyImportant")}: </span>
                      {row.whyImportant}
                    </p>
                    <p className="text-xs text-eve-text">
                      <span className="font-semibold">{t("radiusGuideSectionGoodValue")}: </span>
                      {row.goodValue}
                    </p>
                    <p className="text-xs text-eve-text">
                      <span className="font-semibold">{t("radiusGuideSectionHeuristic")}: </span>
                      {row.ideaFlipHeuristic}
                    </p>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
