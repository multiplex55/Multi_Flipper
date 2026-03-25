package engine

import "testing"

func TestExportedMarketRestrictionHelpers(t *testing.T) {
	if !IsMarketDisabledTypeID(MPTCTypeID) {
		t.Fatalf("MPTC must be market-disabled")
	}
	if IsMarketDisabledTypeID(PLEXTypeID) {
		t.Fatalf("PLEX must not be market-disabled")
	}

	if !IsPlayerStructureLocationID(1_000_000_000_001) {
		t.Fatalf("expected structure location ID to be detected")
	}
	if IsPlayerStructureLocationID(60003760) {
		t.Fatalf("NPC station location ID must not be treated as structure")
	}
}
