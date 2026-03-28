package engine

import "encoding/json"

// UnmarshalJSON keeps backward compatibility with legacy hop payloads that stored
// a single item directly on the hop (TypeID/TypeName/Units/BuyPrice/SellPrice/Profit).
// New payloads should use Items.
func (h *RouteHop) UnmarshalJSON(data []byte) error {
	type alias RouteHop
	var tmp alias
	if err := json.Unmarshal(data, &tmp); err != nil {
		return err
	}
	*h = RouteHop(tmp)
	h.normalizeItemsFromLegacy()
	return nil
}

func (h *RouteHop) normalizeItemsFromLegacy() {
	if len(h.Items) == 0 && h.TypeID > 0 && h.Units > 0 {
		buyCost := float64(h.Units) * h.BuyPrice
		sellValue := float64(h.Units) * h.SellPrice
		margin := 0.0
		if buyCost > 0 {
			margin = ((sellValue - buyCost) / buyCost) * 100
		}
		h.Items = []RouteHopItem{{
			TypeName:      h.TypeName,
			TypeID:        h.TypeID,
			BuyPrice:      h.BuyPrice,
			SellPrice:     h.SellPrice,
			Units:         h.Units,
			BuyCost:       buyCost,
			SellValue:     sellValue,
			Profit:        h.Profit,
			MarginPercent: margin,
		}}
	}

	if len(h.Items) == 0 {
		return
	}
	if h.TypeID == 0 {
		h.TypeID = h.Items[0].TypeID
	}
	if h.TypeName == "" {
		h.TypeName = h.Items[0].TypeName
	}
	if h.Units == 0 {
		h.Units = h.Items[0].Units
	}
	if h.BuyPrice == 0 {
		h.BuyPrice = h.Items[0].BuyPrice
	}
	if h.SellPrice == 0 {
		h.SellPrice = h.Items[0].SellPrice
	}
	if h.Profit == 0 {
		h.Profit = h.Items[0].Profit
	}
	var totalBuy, totalSell, totalProfit float64
	for _, item := range h.Items {
		itemBuy := item.BuyCost
		if itemBuy <= 0 {
			itemBuy = float64(item.Units) * item.BuyPrice
		}
		itemSell := item.SellValue
		if itemSell <= 0 {
			itemSell = float64(item.Units) * item.SellPrice
		}
		totalBuy += itemBuy
		totalSell += itemSell
		if item.Profit != 0 {
			totalProfit += item.Profit
		} else {
			totalProfit += itemSell - itemBuy
		}
	}
	if h.BuyCost == 0 {
		h.BuyCost = totalBuy
	}
	if h.SellValue == 0 {
		h.SellValue = totalSell
	}
	if h.Profit == 0 {
		h.Profit = totalProfit
	}
}
