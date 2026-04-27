export type RadiusActiveControlChip = {
  id: string;
  label: string;
  sectionId: string;
};

type RadiusActiveControlChipsProps = {
  chips: RadiusActiveControlChip[];
  onChipClick: (sectionId: string) => void;
};

export function RadiusActiveControlChips({ chips, onChipClick }: RadiusActiveControlChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1" data-testid="radius-active-control-chips">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="rounded-sm border border-eve-accent/50 bg-eve-accent/10 px-1.5 py-0.5 text-[10px] text-eve-accent hover:bg-eve-accent/20"
          onClick={() => onChipClick(chip.sectionId)}
          data-testid={`radius-active-control-chip:${chip.id}`}
          title={`Open ${chip.sectionId} controls`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
