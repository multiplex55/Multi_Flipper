package db

import (
	"database/sql"
	"testing"

	"eve-flipper/internal/config"

	_ "modernc.org/sqlite"
)

func TestBanlistItemsForUser_CRUDIsolationAndPersistence(t *testing.T) {
	d := openTestDB(t)
	defer d.Close()

	item := config.BanlistItem{TypeID: 34, TypeName: "Tritanium", AddedAt: "2026-03-01T00:00:00Z"}
	if !d.AddBanlistItemForUser("user-a", item) {
		t.Fatal("expected first insert to succeed")
	}
	if d.AddBanlistItemForUser("user-a", item) {
		t.Fatal("expected duplicate insert to be ignored")
	}
	if d.AddBanlistItemForUser("user-b", item) != true {
		t.Fatal("expected same type for other user to insert")
	}

	itemsA := d.GetBanlistItemsForUser("user-a")
	itemsB := d.GetBanlistItemsForUser("user-b")
	if len(itemsA) != 1 || len(itemsB) != 1 {
		t.Fatalf("unexpected item counts: user-a=%d user-b=%d", len(itemsA), len(itemsB))
	}

	setA := d.GetBanlistItemIDSetForUser("user-a")
	if _, ok := setA[34]; !ok {
		t.Fatalf("expected type_id 34 in user-a set: %#v", setA)
	}

	d.DeleteBanlistItemForUser("user-a", 34)
	if len(d.GetBanlistItemsForUser("user-a")) != 0 {
		t.Fatal("expected user-a list to be empty after delete")
	}
	if len(d.GetBanlistItemsForUser("user-b")) != 1 {
		t.Fatal("delete should not affect user-b")
	}
}

func TestBannedStationsForUser_CRUDIsolationAndPersistence(t *testing.T) {
	d := openTestDB(t)
	defer d.Close()

	station := config.BannedStation{
		LocationID:  60003760,
		StationName: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
		SystemID:    30000142,
		SystemName:  "Jita",
		AddedAt:     "2026-03-01T00:00:00Z",
	}
	if !d.AddBannedStationForUser("user-a", station) {
		t.Fatal("expected first station insert to succeed")
	}
	if d.AddBannedStationForUser("user-a", station) {
		t.Fatal("expected duplicate station insert to be ignored")
	}
	if !d.AddBannedStationForUser("user-b", station) {
		t.Fatal("expected same station for other user to insert")
	}

	stationsA := d.GetBannedStationsForUser("user-a")
	stationsB := d.GetBannedStationsForUser("user-b")
	if len(stationsA) != 1 || len(stationsB) != 1 {
		t.Fatalf("unexpected station counts: user-a=%d user-b=%d", len(stationsA), len(stationsB))
	}
	if stationsA[0].SystemID != 30000142 || stationsA[0].SystemName != "Jita" {
		t.Fatalf("unexpected station payload: %+v", stationsA[0])
	}

	setA := d.GetBannedStationIDSetForUser("user-a")
	if _, ok := setA[60003760]; !ok {
		t.Fatalf("expected location_id in user-a set: %#v", setA)
	}

	d.DeleteBannedStationForUser("user-a", 60003760)
	if len(d.GetBannedStationsForUser("user-a")) != 0 {
		t.Fatal("expected user-a station list to be empty after delete")
	}
	if len(d.GetBannedStationsForUser("user-b")) != 1 {
		t.Fatal("station delete should not affect user-b")
	}
}

func TestDB_Migrate_BanlistTablesAndIndexesExist(t *testing.T) {
	d := openTestDB(t)
	defer d.Close()

	mustTable := func(name string) {
		t.Helper()
		var got string
		if err := d.sql.QueryRow(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, name).Scan(&got); err != nil {
			t.Fatalf("expected table %q: %v", name, err)
		}
	}
	mustTable("banlist_items")
	mustTable("banlist_stations")

	mustIndex := func(name string) {
		t.Helper()
		var got string
		if err := d.sql.QueryRow(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`, name).Scan(&got); err != nil {
			t.Fatalf("expected index %q: %v", name, err)
		}
	}
	mustIndex("idx_banlist_items_user")
	mustIndex("idx_banlist_items_user_type")
	mustIndex("idx_banlist_stations_user")
	mustIndex("idx_banlist_stations_user_location")
}

func TestDB_MigrateV27ToLatest_PreservesBanlistPersistence(t *testing.T) {
	sqlDB, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatalf("open in-memory db: %v", err)
	}
	defer sqlDB.Close()

	_, err = sqlDB.Exec(`
		CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
		INSERT INTO schema_version(version) VALUES (27);
	`)
	if err != nil {
		t.Fatalf("seed v27 schema_version: %v", err)
	}

	d := &DB{sql: sqlDB}
	if err := d.migrate(); err != nil {
		t.Fatalf("migrate from v27 to latest: %v", err)
	}

	if !d.AddBanlistItemForUser("reload-user", config.BanlistItem{TypeID: 35, TypeName: "Pyerite", AddedAt: "2026-03-01T01:00:00Z"}) {
		t.Fatal("expected banlist item insert after migration")
	}
	if !d.AddBannedStationForUser("reload-user", config.BannedStation{LocationID: 60008494, StationName: "Amarr VIII (Oris) - Emperor Family Academy", AddedAt: "2026-03-01T01:00:00Z"}) {
		t.Fatal("expected banned station insert after migration")
	}

	if got := d.GetBanlistItemsForUser("reload-user"); len(got) != 1 || got[0].TypeID != 35 {
		t.Fatalf("unexpected banlist items after migration: %+v", got)
	}
	if got := d.GetBannedStationsForUser("reload-user"); len(got) != 1 || got[0].LocationID != 60008494 {
		t.Fatalf("unexpected banned stations after migration: %+v", got)
	}
}
