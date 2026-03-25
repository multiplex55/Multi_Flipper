package db

import (
	"testing"

	"eve-flipper/internal/config"
)

func TestLoadConfigForUser_InvalidScalarValuesKeepDefaults(t *testing.T) {
	d := openTestDB(t)
	defer d.Close()

	userID := "invalid-config-user"
	defaultCfg := config.Default()

	_, err := d.sql.Exec(`
		INSERT OR REPLACE INTO config (user_id, key, value) VALUES
			(?, 'cargo_capacity', 'not-a-number'),
			(?, 'buy_radius', 'abc'),
			(?, 'min_daily_volume', 'oops'),
			(?, 'target_market_location_id', 'bad-int'),
			(?, 'split_trade_fees', 'maybe'),
			(?, 'alert_desktop', 'definitely')
	`, userID, userID, userID, userID, userID, userID)
	if err != nil {
		t.Fatalf("insert invalid config rows: %v", err)
	}

	got := d.LoadConfigForUser(userID)

	if got.CargoCapacity != defaultCfg.CargoCapacity {
		t.Fatalf("CargoCapacity = %v, want default %v", got.CargoCapacity, defaultCfg.CargoCapacity)
	}
	if got.BuyRadius != defaultCfg.BuyRadius {
		t.Fatalf("BuyRadius = %v, want default %v", got.BuyRadius, defaultCfg.BuyRadius)
	}
	if got.MinDailyVolume != defaultCfg.MinDailyVolume {
		t.Fatalf("MinDailyVolume = %v, want default %v", got.MinDailyVolume, defaultCfg.MinDailyVolume)
	}
	if got.TargetMarketLocationID != defaultCfg.TargetMarketLocationID {
		t.Fatalf("TargetMarketLocationID = %v, want default %v", got.TargetMarketLocationID, defaultCfg.TargetMarketLocationID)
	}
	if got.SplitTradeFees != defaultCfg.SplitTradeFees {
		t.Fatalf("SplitTradeFees = %v, want default %v", got.SplitTradeFees, defaultCfg.SplitTradeFees)
	}
	if got.AlertDesktop != defaultCfg.AlertDesktop {
		t.Fatalf("AlertDesktop = %v, want default %v", got.AlertDesktop, defaultCfg.AlertDesktop)
	}
}
