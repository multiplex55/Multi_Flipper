package engine

import "testing"

func TestClassifyRouteOptionLines_AssignsCore(t *testing.T) {
	option := BatchCreateRouteOption{
		ExecutionScore: 80,
		TotalProfitISK: 1_000_000,
		TotalBuyISK:    2_000_000,
		ISKPerJump:     50_000,
		Lines: []BatchCreateRouteLine{
			{
				TypeID:         1,
				ProfitTotalISK: 400_000,
				BuyTotalISK:    500_000,
				RouteJumps:     5,
				FillConfidence: 0.8,
				StaleRisk:      0.2,
				Concentration:  0.2,
			},
		},
	}

	classifyRouteOptionLines(&option, RouteExecutionScoringConfig{})
	if got := option.Lines[0].LineRole; got != routeLineRoleCore {
		t.Fatalf("LineRole = %q, want %q", got, routeLineRoleCore)
	}
}

func TestClassifyRouteOptionLines_AssignsSafeFiller(t *testing.T) {
	option := BatchCreateRouteOption{
		ExecutionScore: 85,
		TotalProfitISK: 1_000_000,
		TotalBuyISK:    3_000_000,
		ISKPerJump:     50_000,
		Lines: []BatchCreateRouteLine{
			{
				TypeID:         1,
				ProfitTotalISK: 150_000,
				BuyTotalISK:    300_000,
				RouteJumps:     6,
				FillConfidence: 0.9,
				StaleRisk:      0.2,
				Concentration:  0.2,
			},
		},
	}

	classifyRouteOptionLines(&option, RouteExecutionScoringConfig{})
	if got := option.Lines[0].LineRole; got != routeLineRoleSafeFiller {
		t.Fatalf("LineRole = %q, want %q", got, routeLineRoleSafeFiller)
	}
}

func TestClassifyRouteOptionLines_AssignsStretchFiller(t *testing.T) {
	option := BatchCreateRouteOption{
		ExecutionScore: 35,
		TotalProfitISK: 1_000_000,
		TotalBuyISK:    4_000_000,
		ISKPerJump:     50_000,
		Lines: []BatchCreateRouteLine{
			{
				TypeID:         1,
				ProfitTotalISK: 50_000,
				BuyTotalISK:    2_000_000,
				RouteJumps:     14,
				FillConfidence: 0.2,
				StaleRisk:      0.9,
				Concentration:  0.9,
			},
		},
	}

	classifyRouteOptionLines(&option, RouteExecutionScoringConfig{})
	if got := option.Lines[0].LineRole; got != routeLineRoleStretchFiller {
		t.Fatalf("LineRole = %q, want %q", got, routeLineRoleStretchFiller)
	}
}

func TestClassifyRouteOptionLines_BoundaryBehavior(t *testing.T) {
	option := BatchCreateRouteOption{
		ExecutionScore: 90,
		TotalProfitISK: 1_000_000,
		TotalBuyISK:    3_000_000,
		ISKPerJump:     50_000,
		Lines: []BatchCreateRouteLine{
			{
				TypeID:         1,
				ProfitTotalISK: 249_999,
				BuyTotalISK:    300_000,
				RouteJumps:     30,
				FillConfidence: 0.5,
				StaleRisk:      0.3,
				Concentration:  0.3,
			},
			{
				TypeID:         2,
				ProfitTotalISK: 250_000,
				BuyTotalISK:    300_000,
				RouteJumps:     30,
				FillConfidence: 0.5,
				StaleRisk:      0.3,
				Concentration:  0.3,
			},
		},
	}

	classifyRouteOptionLines(&option, RouteExecutionScoringConfig{})
	if got := option.Lines[0].LineRole; got == routeLineRoleCore {
		t.Fatalf("below threshold role = %q, want non-core", got)
	}
	if got := option.Lines[1].LineRole; got != routeLineRoleCore {
		t.Fatalf("at threshold role = %q, want %q", got, routeLineRoleCore)
	}
}
