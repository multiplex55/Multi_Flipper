package engine

import (
	"sort"
	"strings"
)

type RegionalHubTrendSnapshot struct {
	ScanTimestamp      string  `json:"scan_timestamp"`
	SourceSystemID     int32   `json:"source_system_id"`
	SourceSystemName   string  `json:"source_system_name"`
	ItemCount          int     `json:"item_count"`
	TargetPeriodProfit float64 `json:"target_period_profit"`
	CapitalRequired    float64 `json:"capital_required"`
	DemandPerDay       float64 `json:"demand_per_day"`
	TopItemSummary     string  `json:"top_item_summary"`
}

type RegionalHubTrendDelta struct {
	ItemCountDelta          int      `json:"item_count_delta"`
	TargetPeriodProfitDelta float64  `json:"target_period_profit_delta"`
	DemandPerDayDelta       float64  `json:"demand_per_day_delta"`
	NewTopItems             []string `json:"new_top_items"`
	RemovedTopItems         []string `json:"removed_top_items"`
}

type RegionalHubTrend struct {
	SourceSystemID int32                     `json:"source_system_id"`
	Latest         RegionalHubTrendSnapshot  `json:"latest_snapshot"`
	Prior          *RegionalHubTrendSnapshot `json:"prior_snapshot,omitempty"`
	Delta          RegionalHubTrendDelta     `json:"delta"`
}

func TopRegionalHubItemSummary(items []RegionalDayTradeItem, limit int) string {
	if len(items) == 0 {
		return ""
	}
	if limit <= 0 {
		limit = 3
	}
	sorted := append([]RegionalDayTradeItem(nil), items...)
	sort.SliceStable(sorted, func(i, j int) bool {
		return sorted[i].TargetPeriodProfit > sorted[j].TargetPeriodProfit
	})
	if len(sorted) > limit {
		sorted = sorted[:limit]
	}
	parts := make([]string, 0, len(sorted))
	for _, item := range sorted {
		name := strings.TrimSpace(item.TypeName)
		if name == "" {
			continue
		}
		parts = append(parts, name)
	}
	return strings.Join(parts, ", ")
}

func ComputeRegionalHubTrendDelta(latest RegionalHubTrendSnapshot, prior *RegionalHubTrendSnapshot) RegionalHubTrendDelta {
	if prior == nil {
		return RegionalHubTrendDelta{}
	}
	priorTop := splitTopItems(prior.TopItemSummary)
	latestTop := splitTopItems(latest.TopItemSummary)
	return RegionalHubTrendDelta{
		ItemCountDelta:          latest.ItemCount - prior.ItemCount,
		TargetPeriodProfitDelta: sanitizeFloat(latest.TargetPeriodProfit - prior.TargetPeriodProfit),
		DemandPerDayDelta:       sanitizeFloat(latest.DemandPerDay - prior.DemandPerDay),
		NewTopItems:             topItemSetDiff(latestTop, priorTop),
		RemovedTopItems:         topItemSetDiff(priorTop, latestTop),
	}
}

func splitTopItems(summary string) []string {
	if strings.TrimSpace(summary) == "" {
		return nil
	}
	parts := strings.Split(summary, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func topItemSetDiff(left []string, right []string) []string {
	if len(left) == 0 {
		return nil
	}
	rightSet := make(map[string]struct{}, len(right))
	for _, item := range right {
		rightSet[item] = struct{}{}
	}
	out := make([]string, 0)
	for _, item := range left {
		if _, ok := rightSet[item]; ok {
			continue
		}
		out = append(out, item)
	}
	return out
}
