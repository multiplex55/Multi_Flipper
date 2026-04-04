import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { BatchBuyVerifier } from "@/features/batchVerifier/BatchBuyVerifier";

type TopActionButtonsProps = {
  watchlistLabel: string;
  banlistLabel: string;
  verifierLabel: string;
  onOpenWatchlist: () => void;
  onOpenBanlist: () => void;
  onTrackAction?: (action: string) => void;
  verifierOpen?: boolean;
  initialManifestText?: string;
  onOpenVerifier?: () => void;
  onCloseVerifier?: () => void;
};

export function TopActionButtons({
  watchlistLabel,
  banlistLabel,
  verifierLabel,
  onOpenWatchlist,
  onOpenBanlist,
  onTrackAction,
  verifierOpen,
  initialManifestText,
  onOpenVerifier,
  onCloseVerifier,
}: TopActionButtonsProps) {
  const [showVerifier, setShowVerifier] = useState(false);
  const verifierTriggerRef = useRef<HTMLButtonElement>(null);
  const verifierModalOpen = verifierOpen ?? showVerifier;

  const openWatchlist = () => {
    onTrackAction?.("watchlist_open_clicked");
    onOpenWatchlist();
  };

  const openBanlist = () => {
    onTrackAction?.("banlist_open_clicked");
    onOpenBanlist();
  };

  const openVerifier = () => {
    onTrackAction?.("batch_price_verify_open_clicked");
    onOpenVerifier?.();
    if (verifierOpen == null) setShowVerifier(true);
  };

  const closeVerifier = () => {
    onCloseVerifier?.();
    if (verifierOpen == null) setShowVerifier(false);
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
        onClick={openBanlist}
        className="flex items-center gap-1.5 h-[34px] px-3 bg-eve-panel border border-eve-border rounded-sm text-xs text-eve-dim hover:text-eve-accent hover:border-eve-accent/50 transition-colors"
        title={banlistLabel}
        aria-label={banlistLabel}
      >
        <span aria-hidden="true">&#128683;</span>
        <span>{banlistLabel}</span>
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
        open={verifierModalOpen}
        onClose={closeVerifier}
        title={verifierLabel}
        width="max-w-6xl"
      >
        <div className="p-3 sm:p-4">
          <BatchBuyVerifier initialManifestText={initialManifestText} />
        </div>
      </Modal>
    </>
  );
}
