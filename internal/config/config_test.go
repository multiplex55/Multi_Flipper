package config

import (
	"testing"
)

func TestDefault_Values(t *testing.T) {
	c := Default()
	if c == nil {
		t.Fatal("Default() returned nil")
	}
	if c.CargoCapacity != 5000 {
		t.Errorf("CargoCapacity = %v, want 5000", c.CargoCapacity)
	}
	if c.BuyRadius != 5 {
		t.Errorf("BuyRadius = %v, want 5", c.BuyRadius)
	}
	if c.SellRadius != 10 {
		t.Errorf("SellRadius = %v, want 10", c.SellRadius)
	}
	if c.MinMargin != 5 {
		t.Errorf("MinMargin = %v, want 5", c.MinMargin)
	}
	if c.SalesTaxPercent != 8 {
		t.Errorf("SalesTaxPercent = %v, want 8", c.SalesTaxPercent)
	}
	if c.AlertTelegram {
		t.Error("AlertTelegram = true, want false")
	}
	if c.AlertDiscord {
		t.Error("AlertDiscord = true, want false")
	}
	if !c.AlertDesktop {
		t.Error("AlertDesktop = false, want true")
	}
	if c.Opacity != 230 {
		t.Errorf("Opacity = %v, want 230", c.Opacity)
	}
	if c.WindowW != 800 || c.WindowH != 600 {
		t.Errorf("Window = %dx%d, want 800x600", c.WindowW, c.WindowH)
	}
	if c.StrategyScore.ProfitWeight <= 0 ||
		c.StrategyScore.RiskWeight <= 0 ||
		c.StrategyScore.VelocityWeight <= 0 ||
		c.StrategyScore.JumpWeight <= 0 ||
		c.StrategyScore.CapitalWeight <= 0 {
		t.Fatalf("StrategyScore should have positive defaults, got %+v", c.StrategyScore)
	}
	if c.StrategyScore.ProfitWeight > 100 ||
		c.StrategyScore.RiskWeight > 100 ||
		c.StrategyScore.VelocityWeight > 100 ||
		c.StrategyScore.JumpWeight > 100 ||
		c.StrategyScore.CapitalWeight > 100 {
		t.Fatalf("StrategyScore should be clamped to 0..100 defaults, got %+v", c.StrategyScore)
	}
}
