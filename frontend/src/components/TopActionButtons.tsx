import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { BatchBuyVerifier } from "@/features/batchVerifier/BatchBuyVerifier";

type TopActionButtonsProps = {
  watchlistLabel: string;
  verifierLabel: string;
  onOpenWatchlist: () => void;
  onTrackAction?: (action: string) => void;
};

export function TopActionButtons({
  watchlistLabel,
  verifierLabel,
  onOpenWatchlist,
  onTrackAction,
}: TopActionButtonsProps) {
  const [showVerifier, setShowVerifier] = useState(false);
  const verifierTriggerRef = useRef<HTMLButtonElement>(null);

  const openWatchlist = () => {
    onTrackAction?.("watchlist_open_clicked");
    onOpenWatchlist();
  };

  const openVerifier = () => {
    onTrackAction?.("batch_price_verify_open_clicked");
    setShowVerifier(true);
  };

  const closeVerifier = () => {
    setShowVerifier(false);
    requestAnimationFrame(() => {
      verifierTriggerRef.current?.focus();
    });
  };

  return (
    <>
      <button
        onClick={openWatchlist}
        className="flex items-center gap-1.5 h-[34px] px-3 bg-eve-panel border border-eve-border rounded-sm text-xs text-eve-dim hover:text-eve-accent hover:border-eve-accent/50 transition-colors"
        title={watchlistLabel}
        aria-label={watchlistLabel}
      >
        <span aria-hidden="true">&#11088;</span>
        <span>{watchlistLabel}</span>
      </button>

      <button
        ref={verifierTriggerRef}
        onClick={openVerifier}
        className="flex items-center gap-1.5 h-[34px] px-3 bg-eve-panel border border-eve-border rounded-sm text-xs text-eve-dim hover:text-eve-accent hover:border-eve-accent/50 transition-colors"
        title={verifierLabel}
        aria-label={verifierLabel}
      >
        <span aria-hidden="true">&#128270;</span>
        <span>{verifierLabel}</span>
      </button>

      <Modal
        open={showVerifier}
        onClose={closeVerifier}
        title={verifierLabel}
        width="max-w-6xl"
      >
        <div className="p-3 sm:p-4">
          <BatchBuyVerifier />
        </div>
      </Modal>
    </>
  );
}
