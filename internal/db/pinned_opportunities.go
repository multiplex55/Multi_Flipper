package db

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const (
	PinnedTabScan        = "scan"
	PinnedTabStation     = "station"
	PinnedTabRegionalDay = "regional_day"
	PinnedTabContracts   = "contracts"
)

type PinnedOpportunity struct {
	UserID         string `json:"user_id"`
	OpportunityKey string `json:"opportunity_key"`
	Tab            string `json:"tab"`
	PayloadJSON    string `json:"payload_json"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type PinnedSnapshot struct {
	ID             int64  `json:"id"`
	UserID         string `json:"user_id"`
	OpportunityKey string `json:"opportunity_key"`
	SnapshotLabel  string `json:"snapshot_label"`
	SnapshotAt     string `json:"snapshot_at"`
	MetricsJSON    string `json:"metrics_json"`
}

func normalizePinnedTab(tab string) string {
	tab = strings.ToLower(strings.TrimSpace(tab))
	switch tab {
	case PinnedTabScan, PinnedTabStation, PinnedTabRegionalDay, PinnedTabContracts:
		return tab
	default:
		return ""
	}
}

func normalizeJSONText(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("json payload is required")
	}
	var v any
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return "", fmt.Errorf("invalid json payload: %w", err)
	}
	encoded, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("normalize json payload: %w", err)
	}
	return string(encoded), nil
}

func (d *DB) AddPinnedOpportunityForUser(userID string, item PinnedOpportunity) error {
	userID = normalizeUserID(userID)
	item.Tab = normalizePinnedTab(item.Tab)
	if item.Tab == "" {
		return fmt.Errorf("invalid pinned tab")
	}
	item.OpportunityKey = strings.TrimSpace(item.OpportunityKey)
	if item.OpportunityKey == "" {
		return fmt.Errorf("opportunity_key is required")
	}
	payloadJSON, err := normalizeJSONText(item.PayloadJSON)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = d.sql.Exec(`
		INSERT INTO pinned_opportunities (
			user_id, opportunity_key, tab, payload_json, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, opportunity_key)
		DO UPDATE SET
			tab = excluded.tab,
			payload_json = excluded.payload_json,
			updated_at = excluded.updated_at
	`, userID, item.OpportunityKey, item.Tab, payloadJSON, now, now)
	return err
}

func (d *DB) DeletePinnedOpportunityForUser(userID string, opportunityKey string) error {
	userID = normalizeUserID(userID)
	opportunityKey = strings.TrimSpace(opportunityKey)
	if opportunityKey == "" {
		return nil
	}
	_, err := d.sql.Exec(`DELETE FROM pinned_opportunities WHERE user_id = ? AND opportunity_key = ?`, userID, opportunityKey)
	if err != nil {
		return err
	}
	_, err = d.sql.Exec(`DELETE FROM pinned_opportunity_snapshots WHERE user_id = ? AND opportunity_key = ?`, userID, opportunityKey)
	return err
}

func (d *DB) ListPinnedOpportunitiesForUser(userID string, tab string) ([]PinnedOpportunity, error) {
	userID = normalizeUserID(userID)
	tab = normalizePinnedTab(tab)
	if tab == "" {
		return []PinnedOpportunity{}, nil
	}

	rows, err := d.sql.Query(`
		SELECT user_id, opportunity_key, tab, payload_json, created_at, updated_at
		  FROM pinned_opportunities
		 WHERE user_id = ? AND tab = ?
		 ORDER BY updated_at DESC, opportunity_key ASC
	`, userID, tab)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]PinnedOpportunity, 0)
	for rows.Next() {
		var item PinnedOpportunity
		if err := rows.Scan(&item.UserID, &item.OpportunityKey, &item.Tab, &item.PayloadJSON, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (d *DB) UpsertPinnedOpportunitySnapshotForUser(userID, opportunityKey string, snap PinnedSnapshot) error {
	userID = normalizeUserID(userID)
	opportunityKey = strings.TrimSpace(opportunityKey)
	if opportunityKey == "" {
		return fmt.Errorf("opportunity_key is required")
	}
	snap.SnapshotLabel = strings.TrimSpace(snap.SnapshotLabel)
	if snap.SnapshotLabel == "" {
		return fmt.Errorf("snapshot_label is required")
	}
	metricsJSON, err := normalizeJSONText(snap.MetricsJSON)
	if err != nil {
		return err
	}
	snapshotAt := strings.TrimSpace(snap.SnapshotAt)
	if snapshotAt == "" {
		snapshotAt = time.Now().UTC().Format(time.RFC3339)
	}

	_, err = d.sql.Exec(`
		INSERT INTO pinned_opportunity_snapshots (
			user_id, opportunity_key, snapshot_label, snapshot_at, metrics_json
		) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id, opportunity_key, snapshot_label)
		DO UPDATE SET
			snapshot_at = excluded.snapshot_at,
			metrics_json = excluded.metrics_json
	`, userID, opportunityKey, snap.SnapshotLabel, snapshotAt, metricsJSON)
	return err
}

func (d *DB) ListPinnedOpportunitySnapshotsForUser(userID, opportunityKey string, limit int) ([]PinnedSnapshot, error) {
	userID = normalizeUserID(userID)
	opportunityKey = strings.TrimSpace(opportunityKey)
	if opportunityKey == "" {
		return []PinnedSnapshot{}, nil
	}
	if limit <= 0 {
		limit = 25
	}
	if limit > 250 {
		limit = 250
	}

	rows, err := d.sql.Query(`
		SELECT id, user_id, opportunity_key, snapshot_label, snapshot_at, metrics_json
		  FROM pinned_opportunity_snapshots
		 WHERE user_id = ? AND opportunity_key = ?
		 ORDER BY snapshot_at DESC, id DESC
		 LIMIT ?
	`, userID, opportunityKey, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]PinnedSnapshot, 0)
	for rows.Next() {
		var snap PinnedSnapshot
		if err := rows.Scan(&snap.ID, &snap.UserID, &snap.OpportunityKey, &snap.SnapshotLabel, &snap.SnapshotAt, &snap.MetricsJSON); err != nil {
			return nil, err
		}
		out = append(out, snap)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
