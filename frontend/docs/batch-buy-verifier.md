# Batch Buy Verifier Design Spec

## 1) Input formats

### 1.1 Batch manifest line format

The verifier accepts one item per line using pipe-separated fields:

```text
<Type Name> | qty <planned_quantity> | buy <target_buy_per_isk> [| <optional_key> <optional_value> ...]
```

- Required fields:
  - `Type Name` (item label, free text)
  - `qty` (integer quantity)
  - `buy` (target buy-per in ISK)
- Optional fields:
  - Any additional `key value` pairs after required fields (example: `sell 154000`, `note route-1`).
- Invalid lines (missing required fields or non-numeric qty/buy) are ignored by parser-level validation.

Example:

```text
Heavy Water | qty 10 | buy 12,000 | sell 15,000 | note route-a
```

### 1.2 Export order tab-delimited format

The verifier accepts rows in tab-delimited column order:

```text
<Type Name>\t<actual_quantity>\t<actual_buy_per_isk>[\t...extra columns]
```

- First three columns are required.
- Extra columns are permitted and ignored by the comparator.
- The summary row with first column `Total:` must be explicitly ignored.

Example rows:

```text
Heavy Water\t10\t12100\tJita 4-4
Total:\t10\t121000\t-
```

## 2) Normalization rules

Normalization is applied before matching planned/export rows:

1. Trim leading/trailing spaces.
2. Collapse internal whitespace runs to a single space.
3. Case-sensitivity policy: preserve original case and compare case-sensitively after whitespace normalization (recommended contract behavior).

Example:

- `"  Republic   Fleet EMP S  "` -> `"Republic Fleet EMP S"`
- `"REPUBLIC FLEET EMP S"` does **not** match `"Republic Fleet EMP S"`.

## 3) Decision states (mutually exclusive)

Each compared row must produce exactly one state:

- `safe`
- `do_not_buy` (actual buy per > allowed buy per)
- `quantity_mismatch` (when strict quantity mode enabled and quantities differ)
- `missing_from_export` (in manifest but not export)
- `unexpected_in_export` (in export but not manifest)

State precedence for matched items:

1. `do_not_buy`
2. `quantity_mismatch`
3. `safe`

Presence states (`missing_from_export` / `unexpected_in_export`) are emitted only for unmatched rows.

## 4) Tolerance settings

Supported tolerance modes:

1. **strict**: no slippage; allowed buy-per = target buy-per.
2. **ISK slippage tolerance**: allowed buy-per = target buy-per + configured ISK amount.
3. **percent slippage tolerance**: allowed buy-per = target buy-per * (1 + tolerance_pct / 100).
4. **quantity mode**:
   - `ignore_mismatch`: quantity differences do not fail row.
   - `require_exact`: quantity differences trigger `quantity_mismatch` unless `do_not_buy` already applies.

## 5) Summary metrics formulas

Let `rows` be all decision rows.

- `safe_count = count(state == safe)`
- `do_not_buy_count = count(state == do_not_buy)`
- `missing_count = count(state == missing_from_export)`
- `unexpected_count = count(state == unexpected_in_export)`
- `extra_isk_vs_plan = Σ((actual_buy_per - target_buy_per) * actual_quantity)` for matched rows
- `estimated_profit_lost = Σ(max(0, extra_isk_vs_plan_row))` for matched rows

Optional diagnostics can include `quantity_mismatch_count` as separate operational tracking.

## 6) Explanation template requirements (non-safe states)

Every non-`safe` row must include a concise deterministic explanation string:

- `do_not_buy`
  - Template: `"Actual buy-per <actual> exceeds allowed target <allowed>."`
  - Include actual buy-per and allowed threshold values.
- `quantity_mismatch`
  - Template: `"Quantity mismatch: planned <planned_qty>, actual <actual_qty>."`
- `missing_from_export`
  - Template: `"Item exists in manifest but not in export order data."`
- `unexpected_in_export`
  - Template: `"Item exists in export order data but not in manifest."`

Explanation strings should be stable and machine-diff-friendly for audit logs and UI snapshots.
