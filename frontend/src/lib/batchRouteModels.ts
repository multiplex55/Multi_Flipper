import type { BatchCreateRouteRequest } from "@/lib/types";

export function normalizeBatchCreateRouteRequest(
  req: BatchCreateRouteRequest,
): BatchCreateRouteRequest {
  if (req.remaining_capacity_m3 === 0 && req.cargo_limit_m3 > 0) {
    return {
      ...req,
      remaining_capacity_m3: req.cargo_limit_m3,
    };
  }
  return req;
}

export function validateBatchCreateRouteRequest(
  req: BatchCreateRouteRequest,
): string[] {
  const errors: string[] = [];

  if (!req.origin_system_id || !req.origin_location_id) {
    errors.push("missing origin");
  }

  if (req.base_batch.base_lines.length === 0) {
    errors.push("empty base lines");
  }

  if (req.cargo_limit_m3 < 0 || req.remaining_capacity_m3 < 0) {
    errors.push("negative cargo/remaining cargo");
  }

  const hasFinalSellLocation = req.base_batch.base_sell_location_id > 0;
  const hasFinalSellSystem = req.base_batch.base_sell_system_id > 0;
  if (!hasFinalSellLocation || !hasFinalSellSystem) {
    errors.push("missing final sell location/system");
  }

  return errors;
}
