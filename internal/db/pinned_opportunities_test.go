package db

import (
	"database/sql"
	"testing"
)

func TestDB_Migrate_PinnedOpportunityTablesAndIndexesExist(t *testing.T) {
	d := openTestDB(t)
	defer d.Close()

	mustTable := func(name string) {
		t.Helper()
		var got string
		if err := d.sql.QueryRow(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, name).Scan(&got); err != nil {
			t.Fatalf("expected table %q: %v", name, err)
		}
	}
	mustIndex := func(name string) {
		t.Helper()
		var got string
		if err := d.sql.QueryRow(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`, name).Scan(&got); err != nil {
			t.Fatalf("expected index %q: %v", name, err)
		}
	}

	mustTable("pinned_opportunities")
	mustTable("pinned_opportunity_snapshots")
	mustIndex("idx_pinned_opportunities_user_tab")
	mustIndex("idx_pinned_opportunities_user_updated")
	mustIndex("idx_pinned_opportunity_snapshots_lookup")
}

func TestPinnedOpportunityCRUD_UserIsolationAndIdempotency(t *testing.T) {
	d := openTestDB(t)
	defer d.Close()

	item := PinnedOpportunity{OpportunityKey: "station:34:60003760", Tab: PinnedTabStation, PayloadJSON: `{"type_id":34}`}
	if err := d.AddPinnedOpportunityForUser("user-a", item); err != nil {
		t.Fatalf("add user-a: %v", err)
	}
	if err := d.AddPinnedOpportunityForUser("user-a", item); err != nil {
		t.Fatalf("idempotent upsert user-a: %v", err)
	}
	if err := d.AddPinnedOpportunityForUser("user-b", item); err != nil {
		t.Fatalf("add user-b: %v", err)
	}

	itemsA, err := d.ListPinnedOpportunitiesForUser("user-a", PinnedTabStation)
	if err != nil {
		t.Fatalf("list user-a: %v", err)
	}
	itemsB, err := d.ListPinnedOpportunitiesForUser("user-b", PinnedTabStation)
	if err != nil {
		t.Fatalf("list user-b: %v", err)
	}
	if len(itemsA) != 1 || len(itemsB) != 1 {
		t.Fatalf("unexpected item counts user-a=%d user-b=%d", len(itemsA), len(itemsB))
	}

	if err := d.DeletePinnedOpportunityForUser("user-a", item.OpportunityKey); err != nil {
		t.Fatalf("delete user-a: %v", err)
	}
	itemsA, _ = d.ListPinnedOpportunitiesForUser("user-a", PinnedTabStation)
	itemsB, _ = d.ListPinnedOpportunitiesForUser("user-b", PinnedTabStation)
	if len(itemsA) != 0 {
		t.Fatalf("expected user-a to be empty after delete, got %d", len(itemsA))
	}
	if len(itemsB) != 1 {
		t.Fatalf("expected user-b to remain unchanged, got %d", len(itemsB))
	}
}

func TestPinnedSnapshots_UpsertAndOrdering(t *testing.T) {
	d := openTestDB(t)
	defer d.Close()

	key := "flip:34:1:2"
	if err := d.UpsertPinnedOpportunitySnapshotForUser("user-a", key, PinnedSnapshot{
		SnapshotLabel: "scan:1",
		SnapshotAt:    "2026-04-04T10:00:00Z",
		MetricsJSON:   `{"profit":10}`,
	}); err != nil {
		t.Fatalf("insert snapshot 1: %v", err)
	}
	if err := d.UpsertPinnedOpportunitySnapshotForUser("user-a", key, PinnedSnapshot{
		SnapshotLabel: "scan:2",
		SnapshotAt:    "2026-04-04T12:00:00Z",
		MetricsJSON:   `{"profit":12}`,
	}); err != nil {
		t.Fatalf("insert snapshot 2: %v", err)
	}
	if err := d.UpsertPinnedOpportunitySnapshotForUser("user-a", key, PinnedSnapshot{
		SnapshotLabel: "scan:1",
		SnapshotAt:    "2026-04-04T13:00:00Z",
		MetricsJSON:   `{"profit":13}`,
	}); err != nil {
		t.Fatalf("upsert snapshot 1: %v", err)
	}

	items, err := d.ListPinnedOpportunitySnapshotsForUser("user-a", key, 10)
	if err != nil {
		t.Fatalf("list snapshots: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("len snapshots = %d, want 2", len(items))
	}
	if items[0].SnapshotAt < items[1].SnapshotAt {
		t.Fatalf("expected DESC snapshot_at ordering: %#v", items)
	}

	other, err := d.ListPinnedOpportunitySnapshotsForUser("user-b", key, 10)
	if err != nil {
		t.Fatalf("list snapshots user-b: %v", err)
	}
	if len(other) != 0 {
		t.Fatalf("expected user-b no snapshots, got %d", len(other))
	}
}

func TestDB_MigrateV28ToLatest_PinnedOpportunityTablesUsable(t *testing.T) {
	sqlDB, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatalf("open in-memory db: %v", err)
	}
	defer sqlDB.Close()

	_, err = sqlDB.Exec(`
		CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
		INSERT INTO schema_version(version) VALUES (28);
	`)
	if err != nil {
		t.Fatalf("seed v28 schema_version: %v", err)
	}

	d := &DB{sql: sqlDB}
	if err := d.migrate(); err != nil {
		t.Fatalf("migrate from v28 to latest: %v", err)
	}
	if err := d.AddPinnedOpportunityForUser("migrated-user", PinnedOpportunity{OpportunityKey: "contract:1", Tab: PinnedTabContracts, PayloadJSON: `{"contract_id":1}`}); err != nil {
		t.Fatalf("insert pinned after migration: %v", err)
	}
}
