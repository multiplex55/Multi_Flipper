import type { RadiusRouteGroupAggregate } from "@/lib/radiusRouteGroups";
import { passesNumericFilter, passesTextFilter } from "@/lib/tableFilters";

export type RadiusRouteGroupColumnKey =
  | "routeLabel"
  | "totalProfit"
  | "totalCapital"
  | "roiPercent"
  | "iskPerJump"
  | "jumps"
  | "itemCount"
  | "cargoUsedPercent"
  | "weakestExecutionQuality"
  | "urgencyBand"
  | "status"
  | "assignedPilot"
  | "verificationStatus";

export type RadiusRouteGroupColumnDef = {
  key: RadiusRouteGroupColumnKey;
  label: string;
  numeric: boolean;
  sortable?: boolean;
  filterable?: boolean;
  getValue: (row: RadiusRouteGroupAggregate) => string | number;
};

export type RadiusRouteGroupSort = {
  key: RadiusRouteGroupColumnKey;
  direction: "asc" | "desc";
};

export const RADIUS_ROUTE_GROUP_COLUMNS: RadiusRouteGroupColumnDef[] = [
  { key: "routeLabel", label: "Route", numeric: false, sortable: true, filterable: true, getValue: (row) => row.routeLabel },
  { key: "totalProfit", label: "Profit", numeric: true, sortable: true, filterable: true, getValue: (row) => row.totalProfit },
  { key: "totalCapital", label: "Capital", numeric: true, sortable: true, filterable: true, getValue: (row) => row.totalCapital },
  { key: "roiPercent", label: "ROI", numeric: true, sortable: true, filterable: true, getValue: (row) => row.roiPercent },
  { key: "iskPerJump", label: "ISK/jump", numeric: true, sortable: true, filterable: true, getValue: (row) => row.iskPerJump },
  { key: "jumps", label: "Jumps", numeric: true, sortable: true, filterable: true, getValue: (row) => row.jumps },
  { key: "itemCount", label: "Items", numeric: true, sortable: true, filterable: true, getValue: (row) => row.itemCount },
  { key: "cargoUsedPercent", label: "Cargo used", numeric: true, sortable: true, filterable: true, getValue: (row) => row.cargoUsedPercent },
  { key: "weakestExecutionQuality", label: "Execution quality", numeric: true, sortable: true, filterable: true, getValue: (row) => row.weakestExecutionQuality },
  { key: "urgencyBand", label: "Urgency", numeric: false, sortable: true, filterable: true, getValue: (row) => row.urgencyBand },
  { key: "status", label: "Status", numeric: false, sortable: true, filterable: true, getValue: (row) => row.status },
  { key: "assignedPilot", label: "Pilot", numeric: false, sortable: true, filterable: true, getValue: (row) => row.assignedPilot },
  { key: "verificationStatus", label: "Verify", numeric: false, sortable: true, filterable: true, getValue: (row) => row.verificationStatus },
];

export function filterRadiusRouteGroups(
  rows: RadiusRouteGroupAggregate[],
  columns: RadiusRouteGroupColumnDef[],
  filters: Partial<Record<RadiusRouteGroupColumnKey, string>>,
): RadiusRouteGroupAggregate[] {
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  return rows.filter((row) => {
    for (const [key, filterValue] of Object.entries(filters) as Array<[RadiusRouteGroupColumnKey, string]>) {
      if (!filterValue?.trim()) continue;
      const column = columnByKey.get(key);
      if (!column || column.filterable === false) continue;
      const value = column.getValue(row);
      if (column.numeric) {
        if (!passesNumericFilter(Number(value) || 0, filterValue)) return false;
      } else if (!passesTextFilter(value, filterValue)) {
        return false;
      }
    }
    return true;
  });
}

function compareRadiusRouteGroupRows(
  left: RadiusRouteGroupAggregate,
  right: RadiusRouteGroupAggregate,
  sort: RadiusRouteGroupSort,
): number {
  const column = RADIUS_ROUTE_GROUP_COLUMNS.find((entry) => entry.key === sort.key);
  const leftValue = column?.getValue(left);
  const rightValue = column?.getValue(right);
  let primary = 0;
  if (column?.numeric) {
    primary = (Number(leftValue) || 0) - (Number(rightValue) || 0);
  } else {
    primary = String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
  }
  if (sort.direction === "desc") primary *= -1;
  if (primary !== 0) return primary;

  const labelTieBreak = left.routeLabel.localeCompare(right.routeLabel);
  if (labelTieBreak !== 0) return labelTieBreak;
  return left.routeKey.localeCompare(right.routeKey);
}

export function sortRadiusRouteGroups(
  rows: RadiusRouteGroupAggregate[],
  sort?: RadiusRouteGroupSort | null,
): RadiusRouteGroupAggregate[] {
  const effectiveSort: RadiusRouteGroupSort = sort ?? { key: "totalProfit", direction: "desc" };
  return [...rows].sort((left, right) => compareRadiusRouteGroupRows(left, right, effectiveSort));
}

export function clampRouteGroupPage(page: number, rowCount: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));
  return Math.max(0, Math.min(page, totalPages - 1));
}
