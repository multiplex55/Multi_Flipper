package engine

import (
	"encoding/json"
	"testing"
)

func TestRouteHopJSONIncludesEnrichmentFields(t *testing.T) {
	t.Parallel()

	hop := RouteHop{
		SystemName:      "Jita",
		StationName:     "Jita IV - Moon 4",
		BuyLocationID:   60003760,
		SellLocationID:  60008494,
		BuyStationName:  "Jita IV - Moon 4",
		SellStationName: "Amarr VIII",
		ItemVolume:      0.01,
		BuyRemaining:    1200,
		SellRemaining:   900,
		ModeledQty:      500,
		EffectiveBuy:    10,
		EffectiveSell:   12,
		HopCapital:      5000,
		HopGrossSell:    6000,
		HopNet:          1000,
		SnapshotTS:      "2026-04-05T00:00:00Z",
		CacheRevision:   42,
	}

	raw, err := json.Marshal(hop)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("Unmarshal map failed: %v", err)
	}

	for _, key := range []string{
		"buy_location_id", "sell_location_id",
		"buy_station_name", "sell_station_name",
		"item_volume",
		"buy_remaining", "sell_remaining", "modeled_qty",
		"effective_buy", "effective_sell", "hop_capital", "hop_gross_sell", "hop_net",
		"snapshot_ts", "cache_revision",
	} {
		if _, ok := decoded[key]; !ok {
			t.Fatalf("expected key %q in payload: %s", key, string(raw))
		}
	}
}

func TestRouteHopJSONOptionalFieldsSerializeConsistently(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		hop  RouteHop
	}{
		{
			name: "zero values preserved",
			hop:  RouteHop{},
		},
		{
			name: "explicit empty strings preserved",
			hop: RouteHop{
				BuyStationName:  "",
				SellStationName: "",
				SnapshotTS:      "",
			},
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			raw, err := json.Marshal(tc.hop)
			if err != nil {
				t.Fatalf("Marshal failed: %v", err)
			}
			var decoded map[string]any
			if err := json.Unmarshal(raw, &decoded); err != nil {
				t.Fatalf("Unmarshal map failed: %v", err)
			}
			for _, key := range []string{
				"buy_location_id", "sell_location_id", "buy_station_name", "sell_station_name",
				"buy_remaining", "sell_remaining", "modeled_qty",
				"effective_buy", "effective_sell", "hop_capital", "hop_gross_sell", "hop_net",
				"snapshot_ts", "cache_revision",
			} {
				if _, ok := decoded[key]; !ok {
					t.Fatalf("expected key %q in payload: %s", key, string(raw))
				}
			}
		})
	}
}

func TestRouteHopLegacyPayloadCompatibility(t *testing.T) {
	t.Parallel()

	legacyPayload := []byte(`{
		"SystemName":"Jita",
		"DestSystemName":"Amarr",
		"TypeID":34,
		"BuyPrice":5.0,
		"SellPrice":6.2,
		"Units":1000,
		"Profit":1200
	}`)

	var hop RouteHop
	if err := json.Unmarshal(legacyPayload, &hop); err != nil {
		t.Fatalf("legacy unmarshal failed: %v", err)
	}

	if hop.BuyLocationID != 0 || hop.SellLocationID != 0 {
		t.Fatalf("legacy payload should default location ids to 0, got buy=%d sell=%d", hop.BuyLocationID, hop.SellLocationID)
	}
	if hop.ModeledQty != 0 || hop.EffectiveBuy != 0 || hop.EffectiveSell != 0 {
		t.Fatalf("legacy payload should default execution metrics to zero, got qty=%d buy=%.2f sell=%.2f", hop.ModeledQty, hop.EffectiveBuy, hop.EffectiveSell)
	}
}
