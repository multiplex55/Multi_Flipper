package db

import (
	"database/sql"
	"eve-flipper/internal/engine"
	"log"
)

func (d *DB) InsertRegionalHubSnapshots(scanID int64, hubs []engine.RegionalDayTradeHub) {
	if scanID == 0 || len(hubs) == 0 {
		return
	}
	var scanTimestamp string
	if err := d.sql.QueryRow(`SELECT timestamp FROM scan_history WHERE id = ?`, scanID).Scan(&scanTimestamp); err != nil {
		log.Printf("[DB] InsertRegionalHubSnapshots load timestamp scan=%d: %v", scanID, err)
		return
	}

	tx, err := d.sql.Begin()
	if err != nil {
		log.Printf("[DB] InsertRegionalHubSnapshots begin tx: %v", err)
		return
	}

	stmt, err := tx.Prepare(`INSERT OR REPLACE INTO regional_hub_snapshots (
		scan_id, scan_timestamp, source_system_id, source_system_name,
		item_count, target_period_profit, capital_required, demand_per_day, top_item_summary
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		tx.Rollback()
		log.Printf("[DB] InsertRegionalHubSnapshots prepare: %v", err)
		return
	}
	defer stmt.Close()

	for _, hub := range hubs {
		summary := engine.TopRegionalHubItemSummary(hub.Items, 3)
		if _, err := stmt.Exec(
			scanID,
			scanTimestamp,
			hub.SourceSystemID,
			hub.SourceSystemName,
			hub.ItemCount,
			hub.TargetPeriodProfit,
			hub.CapitalRequired,
			hub.TargetDemandPerDay,
			summary,
		); err != nil {
			tx.Rollback()
			log.Printf("[DB] InsertRegionalHubSnapshots exec source_system_id=%d: %v", hub.SourceSystemID, err)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("[DB] InsertRegionalHubSnapshots commit: %v", err)
	}
}

func (d *DB) GetRegionalHubSnapshotPair(scanID int64, sourceSystemID int32) (latest engine.RegionalHubTrendSnapshot, prior *engine.RegionalHubTrendSnapshot, ok bool) {
	var scanTimestamp string
	if err := d.sql.QueryRow(`SELECT timestamp FROM scan_history WHERE id = ?`, scanID).Scan(&scanTimestamp); err != nil {
		if err != sql.ErrNoRows {
			log.Printf("[DB] GetRegionalHubSnapshotPair load timestamp scan=%d: %v", scanID, err)
		}
		return engine.RegionalHubTrendSnapshot{}, nil, false
	}

	rows, err := d.sql.Query(`
		SELECT
			scan_timestamp,
			source_system_id,
			source_system_name,
			item_count,
			target_period_profit,
			capital_required,
			demand_per_day,
			top_item_summary
		FROM regional_hub_snapshots
		WHERE source_system_id = ? AND scan_timestamp <= ?
		ORDER BY scan_timestamp DESC, id DESC
		LIMIT 2
	`, sourceSystemID, scanTimestamp)
	if err != nil {
		log.Printf("[DB] GetRegionalHubSnapshotPair query source_system_id=%d: %v", sourceSystemID, err)
		return engine.RegionalHubTrendSnapshot{}, nil, false
	}
	defer rows.Close()

	snaps := make([]engine.RegionalHubTrendSnapshot, 0, 2)
	for rows.Next() {
		var snapshot engine.RegionalHubTrendSnapshot
		if scanErr := rows.Scan(
			&snapshot.ScanTimestamp,
			&snapshot.SourceSystemID,
			&snapshot.SourceSystemName,
			&snapshot.ItemCount,
			&snapshot.TargetPeriodProfit,
			&snapshot.CapitalRequired,
			&snapshot.DemandPerDay,
			&snapshot.TopItemSummary,
		); scanErr != nil {
			log.Printf("[DB] GetRegionalHubSnapshotPair scan row source_system_id=%d: %v", sourceSystemID, scanErr)
			continue
		}
		snaps = append(snaps, snapshot)
	}
	if len(snaps) == 0 {
		return engine.RegionalHubTrendSnapshot{}, nil, false
	}
	latest = snaps[0]
	if len(snaps) > 1 {
		priorSnapshot := snaps[1]
		prior = &priorSnapshot
	}
	return latest, prior, true
}
