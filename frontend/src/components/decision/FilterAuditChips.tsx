export type FilterAuditChip = { label: string; value: string | number };

export function FilterAuditChips({ chips }: { chips: FilterAuditChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <span
          key={`${chip.label}:${chip.value}`}
          className="rounded-sm border border-eve-border/60 bg-eve-panel/40 px-1.5 py-0.5 text-[10px] text-eve-dim"
        >
          {chip.label}: {chip.value}
        </span>
      ))}
    </div>
  );
}
