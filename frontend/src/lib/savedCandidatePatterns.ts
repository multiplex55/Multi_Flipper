const STORAGE_KEY = "eve-decision-candidate-patterns:v1";

export type SavedCandidatePattern = {
  id: string;
  label: string;
  tab: "routes" | "station" | "contracts";
  query: string;
  pinned: boolean;
  updatedAt: string;
};

export function loadSavedCandidatePatterns(): SavedCandidatePattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCandidatePattern[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCandidatePattern(input: Omit<SavedCandidatePattern, "id" | "updatedAt">): SavedCandidatePattern[] {
  const current = loadSavedCandidatePatterns();
  const nextPattern: SavedCandidatePattern = {
    ...input,
    id: `${input.tab}:${input.label.toLowerCase().replace(/\s+/g, "-")}:${input.query.toLowerCase()}`,
    updatedAt: new Date().toISOString(),
  };
  const filtered = current.filter((item) => item.id !== nextPattern.id);
  const next = [nextPattern, ...filtered].slice(0, 30);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
