import { radiusColumnRegistry } from "@/lib/radiusColumnRegistry";

export type RadiusColumnGuideRow = {
  columnKey: string;
  title: string;
  whatItIs: string;
  whyImportant: string;
  goodValue: string;
  ideaFlipHeuristic: string;
  category: string;
  applicability: "row" | "route" | "both";
  tooltip: string;
  formatHint?: string;
};

export const radiusColumnGuideRows: RadiusColumnGuideRow[] = radiusColumnRegistry.map((entry) => ({
  columnKey: entry.key,
  title: entry.title,
  whatItIs: entry.guideCopy.whatItIs,
  whyImportant: entry.guideCopy.whyImportant,
  goodValue: entry.guideCopy.goodValue,
  ideaFlipHeuristic: entry.guideCopy.ideaFlipHeuristic,
  category: entry.category,
  applicability: entry.applicability,
  tooltip: entry.tooltip,
  formatHint: entry.formatHint,
}));

export const radiusColumnHintTextByKey: Record<string, string> = Object.fromEntries(
  radiusColumnGuideRows.map((row) => [row.columnKey, row.tooltip]),
);
