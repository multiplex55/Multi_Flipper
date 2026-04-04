# EVE Flipper

EVE Flipper is a local-first market analysis platform for EVE Online traders.
It combines live ESI order books, historical market behavior, and execution-aware math to surface actionable opportunities across multiple trading workflows.

[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Release](https://img.shields.io/github/v/release/ilyaux/Eve-flipper)](https://github.com/ilyaux/Eve-flipper/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/ilyaux/Eve-flipper/total)](https://github.com/ilyaux/Eve-flipper/releases)
[![Last Commit](https://img.shields.io/github/last-commit/ilyaux/Eve-flipper)](https://github.com/ilyaux/Eve-flipper/commits/master)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white)](https://discord.gg/rnR2bw6XXX)

## What It Includes

### Trading Tabs
- `Flipper (Radius)`: local buy/sell opportunities with execution-aware metrics.
- `Regional Trade`: cross-region day-trade scanner with target marketplace controls and grouped output.
- `Contract Arbitrage`: contract valuation and liquidation scenarios.
- `Route`: multi-hop route builder with ISK/jump constraints.
- `Station Trading`: same-station scanner with liquidity/risk filters.
- `Industry`: production planning and industry ledger workflows.
- `War Tracker`: demand/activity view for region-level opportunities.
- `PLEX+`: PLEX analytics and profitability dashboards.

### Core UX and Analysis Features
- `Execution-aware pricing`: expected fill price, slippage, fillability, and real profit fields.
- `System blacklist`: ignore selected systems globally in scan parameters.
- `Batch Builder`: build same-route cargo manifests from a selected deal.
- `Auto-refresh`: cache-aware refresh for Flipper and Regional tabs.
- `Player structures support`: optional structure inclusion (requires EVE login and access).
- `Watchlist + Scan History`: persist and revisit tracked items and previous scans.
- `Pinned Opportunities`: keep user-scoped opportunities pinned across Scan, Station Trading, Regional Trade, and Contract Arbitrage flows.

## Pinned Opportunities Tab

### What it is
Pinned Opportunities is persistent, user-scoped tracking for selected opportunities across `scan`, `station`, `regional_day`, and `contracts` views. You can pin in each source table, then review all tracked rows in one compare-focused tab.

### How to use
1. Run any supported scan/tab and identify an opportunity to track.
2. Click **Pin** in the relevant source table:
   - `ScanResultsTable`
   - `StationTrading` table
   - `RegionalDayTraderTable`
   - `ContractResultsTable`
3. Open the **Pinned Opportunities** tab to review the latest normalized metrics.
4. Use the compare filter to switch baseline:
   - `Last scan`
   - `24h`
   - `Custom snapshot`
5. Interpret delta columns and trend colors/icons.
6. Use **Unpin** on rows you no longer want to track.

### Metric semantics
- **Profit**: current normalized profit value, plus delta versus the selected baseline.
- **Margin**: current normalized margin percent, with both absolute percentage-point delta and relative percent change where available.
- **Volume**: normalized liquidity/turnover indicator for the source row.
- **Route risk**: normalized route/safety risk proxy for the source row; increases indicate more risk and decreases indicate reduced risk.

Trend indicators use shared direction semantics:
- **Green / ▲**: positive increase versus baseline.
- **Red / ▼**: negative decrease versus baseline.
- **Dim / •**: neutral/no change.
- **—**: no baseline available yet.

Formatting and rounding use existing frontend formatter helpers for consistency:
- ISK values use the same `formatISK` conventions.
- Margin/percent values use `formatMargin`.
- Counts/other numeric values use `formatNumber`.

### Source-specific pinning notes
- Rows from all supported tabs are normalized into one pinned payload schema (`source`, `opportunity_key`, normalized `metrics`, optional metadata).
- Stable identity is preserved with deterministic keys where possible:
  - Scan + Regional: `flip:{type_id}:{buy_location_id}:{sell_location_id}`
  - Station: `station:{type_id}:{station_id}`
  - Contracts: `contract:{contract_id}`
- Source caveats:
  - Contract rows may include contract-specific context (for example liquidation-jump-style risk fields).
  - Station rows can include station/system-scoped liquidity and station-specific risk proxies.
  - Scan/regional rows include route-oriented buy/sell location identity and jump/risk proxies.

### Troubleshooting
- **Pin button missing**: confirm you are in a supported table/view and (where required) using the correct auth/user scope for that workflow.
- **No delta shown**: a baseline snapshot does not exist yet for the selected compare mode.
- **Unexpected trend**: confirm the compare filter (`Last scan`, `24h`, `Custom snapshot`) matches the baseline you intended.
- **Row disappeared**: the opportunity may no longer exist in the latest scan result set; pinned records and snapshots remain source-of-truth history for comparisons.

### Local-First Runtime
- Single backend binary with embedded frontend.
- Default bind: `127.0.0.1:13370`.
- SQLite persistence for config, history, and local state.

## Screenshots

| Station Trading | Route Trading | Flipper (Radius) |
|---|---|---|
| ![Station Trading](assets/screenshot-station.png) | ![Route Trading](assets/screenshot-routes.png) | ![Radius Scan](assets/screenshot-radius.png) |

## Quick Start

### Option 1: Release binaries

Download the latest build:
- https://github.com/ilyaux/Eve-flipper/releases

Release asset naming:
- Classic binary: `eve-flipper-windows-amd64.exe` (and `linux/darwin` variants)
- Wails desktop binaries: `eve-flipper-wails-windows-amd64.exe`, `eve-flipper-wails-linux-amd64`, `eve-flipper-wails-linux-arm64`, `eve-flipper-wails-darwin-amd64`, `eve-flipper-wails-darwin-arm64`

Run the binary and open:
- `http://127.0.0.1:13370`

### Option 2: Build from source

Prerequisites:
- Go `1.25+`
- Node.js `20+`
- npm

```bash
git clone https://github.com/ilyaux/Eve-flipper.git
cd Eve-flipper
npm -C frontend install
npm -C frontend run build
go build -o build/eve-flipper .
./build/eve-flipper
```

Windows PowerShell helpers:

```powershell
.\make.ps1 build
.\make.ps1 run
```

Unix Make targets:

```bash
make build
make run
```

### Option 3: Wails desktop variant (separate mode)

This mode keeps the existing runtime modes untouched (`Go embedded web app` and `Tauri`),
and adds an additional desktop build powered by Wails.

PowerShell:

```powershell
.\make.ps1 wails
```

Output:
- `build/eve-flipper-wails.exe`

Manual build equivalent:

```bash
go build -tags wails,production -ldflags "-s -w -H=windowsgui -X main.version=dev" -o build/eve-flipper-wails.exe .
```

Run directly:

```powershell
.\make.ps1 wails-run
```

Unix Make:

```bash
make wails
make wails-run
```

## Runtime Flags

```bash
./eve-flipper --host 127.0.0.1 --port 13370
```

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | Bind address (`0.0.0.0` for LAN/remote access) |
| `--port` | `13370` | HTTP port |

## EVE SSO (Optional)

Many scanners work without login, but these features require EVE SSO:
- Character-aware fees/skills autofill
- Character orders/assets-based workflows
- Player structure market data and structure names
- Corporation dashboards/endpoints

Create `.env` in repo root for local/source builds:

```env
ESI_CLIENT_ID=your-client-id
ESI_CLIENT_SECRET=your-client-secret
ESI_CALLBACK_URL=http://localhost:13370/api/auth/callback
```

Do not commit `.env`.

## Development Workflow

Backend:

```bash
go run .
```

Frontend dev server:

```bash
npm -C frontend install
npm -C frontend run dev
```

Tests:

```bash
go test ./...
```

Production frontend build check:

```bash
npm -C frontend run build
```

Docs validation check:

```bash
make docs-check
```

## Pinned Opportunities API / Dev Notes

Pinned opportunity endpoints (user-scoped):
- `GET /api/pinned-opportunities`
- `POST /api/pinned-opportunities`
- `DELETE /api/pinned-opportunities/{opportunityKey}`
- `GET /api/pinned-opportunities/snapshots`
- `POST /api/pinned-opportunities/snapshots`

Minimal add-pin payload example:

```json
{
  "opportunity_key": "flip:34:60003760:60008494",
  "tab": "scan",
  "payload": {
    "source": "scan",
    "opportunity_key": "flip:34:60003760:60008494",
    "type_id": 34,
    "metrics": {
      "profit": 1250000,
      "margin": 12.4,
      "volume": 8500,
      "route_risk": 3
    }
  }
}
```

## Documentation

- Project wiki: https://github.com/ilyaux/Eve-flipper/wiki
- Getting Started: https://github.com/ilyaux/Eve-flipper/wiki/Getting-Started
- API Reference: https://github.com/ilyaux/Eve-flipper/wiki/API-Reference
- Station Trading: https://github.com/ilyaux/Eve-flipper/wiki/Station-Trading
- Contract Scanner: https://github.com/ilyaux/Eve-flipper/wiki/Contract-Scanner
- Execution Plan: https://github.com/ilyaux/Eve-flipper/wiki/Execution-Plan
- PLEX Dashboard: https://github.com/ilyaux/Eve-flipper/wiki/PLEX-Dashboard

## Security Notes

- By default, server listens only on localhost.
- ESI credentials are optional for non-SSO features.
- If exposed beyond localhost (`--host 0.0.0.0`), use your own network hardening (firewall/reverse proxy/TLS).

## Contributing

See:
- `CONTRIBUTING.md`

## License

MIT License. See `LICENSE`.

## Disclaimer

EVE Flipper is an independent third-party project and is not affiliated with CCP Games.
EVE Online and related trademarks are property of CCP hf.
