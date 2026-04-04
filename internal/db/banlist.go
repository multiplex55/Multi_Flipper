package db

import (
	"database/sql"

	"eve-flipper/internal/config"
)

func (d *DB) GetBanlistItemsForUser(userID string) []config.BanlistItem {
	userID = normalizeUserID(userID)

	rows, err := d.sql.Query(`
		SELECT type_id, type_name, added_at
		  FROM banlist_items
		 WHERE user_id = ?
		 ORDER BY added_at DESC, type_id ASC
	`, userID)
	if err != nil {
		return []config.BanlistItem{}
	}
	defer rows.Close()

	items := make([]config.BanlistItem, 0)
	for rows.Next() {
		var item config.BanlistItem
		if err := rows.Scan(&item.TypeID, &item.TypeName, &item.AddedAt); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items
}

func (d *DB) AddBanlistItemForUser(userID string, item config.BanlistItem) bool {
	userID = normalizeUserID(userID)

	res, err := d.sql.Exec(`
		INSERT OR IGNORE INTO banlist_items (user_id, type_id, type_name, added_at)
		VALUES (?, ?, ?, ?)
	`, userID, item.TypeID, item.TypeName, item.AddedAt)
	if err != nil {
		return false
	}
	n, _ := res.RowsAffected()
	return n > 0
}

func (d *DB) DeleteBanlistItemForUser(userID string, typeID int32) {
	userID = normalizeUserID(userID)
	_, _ = d.sql.Exec(`DELETE FROM banlist_items WHERE user_id = ? AND type_id = ?`, userID, typeID)
}

func (d *DB) GetBanlistItemIDSetForUser(userID string) map[int32]struct{} {
	userID = normalizeUserID(userID)

	rows, err := d.sql.Query(`SELECT type_id FROM banlist_items WHERE user_id = ?`, userID)
	if err != nil {
		return map[int32]struct{}{}
	}
	defer rows.Close()

	set := make(map[int32]struct{})
	for rows.Next() {
		var typeID int32
		if err := rows.Scan(&typeID); err != nil {
			continue
		}
		set[typeID] = struct{}{}
	}
	return set
}

func (d *DB) GetBannedStationsForUser(userID string) []config.BannedStation {
	userID = normalizeUserID(userID)

	rows, err := d.sql.Query(`
		SELECT location_id, station_name, system_id, system_name, added_at
		  FROM banlist_stations
		 WHERE user_id = ?
		 ORDER BY added_at DESC, location_id ASC
	`, userID)
	if err != nil {
		return []config.BannedStation{}
	}
	defer rows.Close()

	items := make([]config.BannedStation, 0)
	for rows.Next() {
		var item config.BannedStation
		var systemID sql.NullInt64
		var systemName sql.NullString
		if err := rows.Scan(&item.LocationID, &item.StationName, &systemID, &systemName, &item.AddedAt); err != nil {
			continue
		}
		if systemID.Valid {
			item.SystemID = int32(systemID.Int64)
		}
		if systemName.Valid {
			item.SystemName = systemName.String
		}
		items = append(items, item)
	}
	return items
}

func (d *DB) AddBannedStationForUser(userID string, station config.BannedStation) bool {
	userID = normalizeUserID(userID)

	var systemID any
	if station.SystemID > 0 {
		systemID = station.SystemID
	}
	var systemName any
	if station.SystemName != "" {
		systemName = station.SystemName
	}

	res, err := d.sql.Exec(`
		INSERT OR IGNORE INTO banlist_stations (user_id, location_id, station_name, system_id, system_name, added_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, userID, station.LocationID, station.StationName, systemID, systemName, station.AddedAt)
	if err != nil {
		return false
	}
	n, _ := res.RowsAffected()
	return n > 0
}

func (d *DB) DeleteBannedStationForUser(userID string, locationID int64) {
	userID = normalizeUserID(userID)
	_, _ = d.sql.Exec(`DELETE FROM banlist_stations WHERE user_id = ? AND location_id = ?`, userID, locationID)
}

func (d *DB) GetBannedStationIDSetForUser(userID string) map[int64]struct{} {
	userID = normalizeUserID(userID)

	rows, err := d.sql.Query(`SELECT location_id FROM banlist_stations WHERE user_id = ?`, userID)
	if err != nil {
		return map[int64]struct{}{}
	}
	defer rows.Close()

	set := make(map[int64]struct{})
	for rows.Next() {
		var locationID int64
		if err := rows.Scan(&locationID); err != nil {
			continue
		}
		set[locationID] = struct{}{}
	}
	return set
}
