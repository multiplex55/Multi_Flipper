import { useI18n } from "@/lib/i18n";
import { radiusColumnGuideRows } from "@/lib/radiusColumnGuide";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RadiusColumnGuideModal({ open, onClose }: Props) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("radiusGuideModalTitle")}
      width="max-w-4xl"
    >
      <div className="p-4 sm:p-5 space-y-4" aria-label="radius-column-guide-content">
        <p className="text-sm text-eve-dim">{t("radiusGuideModalIntro")}</p>
        <div
          className="max-h-[60vh] overflow-y-auto space-y-3 pr-1"
          data-testid="radius-column-guide-scroll"
        >
          {radiusColumnGuideRows.map((row) => (
            <section
              key={row.columnKey}
              className="rounded-sm border border-eve-border bg-eve-panel/40 p-3 space-y-2"
              aria-label={`${row.title} guide`}
            >
              <h3 className="text-sm font-semibold text-eve-accent">{row.title}</h3>
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
      </div>
    </Modal>
  );
}
