package engine

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"

	"eve-flipper/internal/esi"
)

type BatchCreateRouteParams struct {
	OriginSystemID       int32
	BaseBuySystemID      int32
	FinalSellSystemID    int32
	FinalSellLocationID  int64
	CargoLimitM3         float64
	RemainingCapacityM3  float64
	MinMargin            float64
	MinRouteSecurity     float64
	IncludeStructures    bool
	RouteMaxJumps        int
	SplitTradeFees       bool
	SalesTaxPercent      float64
	BuyBrokerFeePercent  float64
	SellBrokerFeePercent float64
	BuySalesTaxPercent   float64
	SellSalesTaxPercent  float64
	BrokerFeePercent     float64
}

type BatchCreateRouteLine struct {
	TypeID         int32
	TypeName       string
	Units          int64
	UnitVolumeM3   float64
	BuySystemID    int32
	BuyLocationID  int64
	SellSystemID   int32
	SellLocationID int64
	BuyTotalISK    float64
	SellTotalISK   float64
	ProfitTotalISK float64
	RouteJumps     int
}

type BatchCreateRouteOption struct {
	OptionID       string
	Lines          []BatchCreateRouteLine
	AddedVolumeM3  float64
	TotalBuyISK    float64
	TotalSellISK   float64
	TotalProfitISK float64
	TotalJumps     int
	ISKPerJump     float64
}

type BatchCreateRouteResult struct {
	Options      []BatchCreateRouteOption
	Diagnostics  []string
	SelectedID   string
	SelectedRank int
}

func (s *Scanner) CreateBatchRoute(ctx context.Context, params BatchCreateRouteParams) (BatchCreateRouteResult, error) {
	result := BatchCreateRouteResult{Diagnostics: make([]string, 0, 2)}
	if ctx != nil && ctx.Err() != nil {
		return result, ctx.Err()
	}
	if s == nil || s.SDE == nil || s.ESI == nil {
		return result, fmt.Errorf("batch route planner unavailable")
	}

	if params.RemainingCapacityM3 <= 0 {
		result.Diagnostics = append(result.Diagnostics, "no remaining cargo capacity; nothing to add")
		return result, nil
	}

	segmentA := s.jumpsBetweenWithSecurity(params.OriginSystemID, params.BaseBuySystemID, params.MinRouteSecurity)
	segmentB := s.jumpsBetweenWithSecurity(params.BaseBuySystemID, params.FinalSellSystemID, params.MinRouteSecurity)
	if segmentA == UnreachableJumps || segmentB == UnreachableJumps {
		result.Diagnostics = append(result.Diagnostics, "route constraints make segment A or B unreachable")
		return result, nil
	}
	if params.RouteMaxJumps > 0 && (segmentA+segmentB) > params.RouteMaxJumps {
		result.Diagnostics = append(result.Diagnostics, "route exceeds max jump constraint")
		return result, nil
	}

	baseRegionID := s.SDE.Universe.SystemRegion[params.BaseBuySystemID]
	finalRegionID := s.SDE.Universe.SystemRegion[params.FinalSellSystemID]
	if baseRegionID == 0 || finalRegionID == 0 {
		return result, fmt.Errorf("unable to resolve market regions for route")
	}

	var sellOrders, buyOrders []esi.MarketOrder
	var sellErr, buyErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		sellOrders, sellErr = s.ESI.FetchRegionOrders(baseRegionID, "sell")
	}()
	go func() {
		defer wg.Done()
		buyOrders, buyErr = s.ESI.FetchRegionOrders(finalRegionID, "buy")
	}()
	wg.Wait()
	if sellErr != nil {
		return result, fmt.Errorf("fetch sell orders: %w", sellErr)
	}
	if buyErr != nil {
		return result, fmt.Errorf("fetch buy orders: %w", buyErr)
	}

	idx := buildOrderIndexWithFilters(sellOrders, buyOrders, params.IncludeStructures)
	sellsByType := idx.cheapestSell[params.BaseBuySystemID]
	buysByType := idx.highestBuy[params.FinalSellSystemID]
	if len(sellsByType) == 0 || len(buysByType) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no compatible market orders for base buy/final sell")
		return result, nil
	}

	buyCostMult, sellRevenueMult := tradeFeeMultipliers(tradeFeeInputs{
		SplitTradeFees:       params.SplitTradeFees,
		BrokerFeePercent:     params.BrokerFeePercent,
		SalesTaxPercent:      params.SalesTaxPercent,
		BuyBrokerFeePercent:  params.BuyBrokerFeePercent,
		SellBrokerFeePercent: params.SellBrokerFeePercent,
		BuySalesTaxPercent:   params.BuySalesTaxPercent,
		SellSalesTaxPercent:  params.SellSalesTaxPercent,
	})

	lines := make([]BatchCreateRouteLine, 0, len(sellsByType))
	for typeID, sell := range sellsByType {
		itemType := s.SDE.Types[typeID]
		if itemType == nil || itemType.Volume <= 0 {
			continue
		}
		buyLevels := buysByType[typeID]
		if len(buyLevels) == 0 {
			continue
		}

		for _, buy := range buyLevels {
			maxUnitsByCargo := int64(math.Floor(params.RemainingCapacityM3 / itemType.Volume))
			if maxUnitsByCargo <= 0 {
				break
			}
			units := min64(maxUnitsByCargo, int64(sell.VolumeRemain), int64(buy.VolumeRemain))
			if units <= 0 || int32(units) < buy.MinVolume {
				continue
			}
			effectiveBuy := sell.Price * buyCostMult
			effectiveSell := buy.Price * sellRevenueMult
			profitPerUnit := effectiveSell - effectiveBuy
			if profitPerUnit <= 0 {
				continue
			}
			margin := (profitPerUnit / effectiveBuy) * 100
			if margin < params.MinMargin {
				continue
			}
			lines = append(lines, BatchCreateRouteLine{
				TypeID:         typeID,
				TypeName:       itemType.Name,
				Units:          units,
				UnitVolumeM3:   itemType.Volume,
				BuySystemID:    params.BaseBuySystemID,
				BuyLocationID:  sell.LocationID,
				SellSystemID:   params.FinalSellSystemID,
				SellLocationID: buy.LocationID,
				BuyTotalISK:    float64(units) * sell.Price,
				SellTotalISK:   float64(units) * buy.Price,
				ProfitTotalISK: float64(units) * profitPerUnit,
				RouteJumps:     segmentA + segmentB,
			})
		}
	}
	lines = filterAdditionsByFinalSell(lines, params.FinalSellLocationID)
	if len(lines) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no profitable additions found for selected destination")
		return result, nil
	}
	sort.Slice(lines, func(i, j int) bool {
		if lines[i].ProfitTotalISK == lines[j].ProfitTotalISK {
			return lines[i].TypeID < lines[j].TypeID
		}
		return lines[i].ProfitTotalISK > lines[j].ProfitTotalISK
	})

	fitted := fitAdditionsToRemainingCargo(lines, params.RemainingCapacityM3)
	if len(fitted) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no additions fit remaining cargo after capacity enforcement")
		return result, nil
	}

	mergedLines := mergeBaseAndAdditions(nil, fitted)
	option := BatchCreateRouteOption{
		OptionID: fmt.Sprintf("batch-option-%d", 1),
		Lines:    make([]BatchCreateRouteLine, 0, len(mergedLines)),
	}
	for _, line := range mergedLines {
		lineVol := float64(line.Units) * line.UnitVolumeM3
		option.Lines = append(option.Lines, line)
		option.AddedVolumeM3 += lineVol
		option.TotalBuyISK += line.BuyTotalISK
		option.TotalSellISK += line.SellTotalISK
		option.TotalProfitISK += line.ProfitTotalISK
	}
	if option.AddedVolumeM3 > 0 {
		option.TotalJumps = segmentA + segmentB
		if option.TotalJumps > 0 {
			option.ISKPerJump = option.TotalProfitISK / float64(option.TotalJumps)
		}
		ranked := rankRouteOptions([]BatchCreateRouteOption{option}, map[string]float64{option.OptionID: option.TotalProfitISK}, params.CargoLimitM3)
		result.Options = ranked
		result.SelectedID = ranked[0].OptionID
		result.SelectedRank = 1
		return result, nil
	}
	result.Diagnostics = append(result.Diagnostics, "no additions fit remaining cargo after capacity enforcement")
	return result, nil
}

func min64(v int64, vals ...int64) int64 {
	m := v
	for _, x := range vals {
		if x < m {
			m = x
		}
	}
	return m
}
