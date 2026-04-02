import { useI18n } from "@/lib/i18n";
import type { ScanParams, StrategyScoreConfig } from "@/lib/types";
import { ScoringProfileEditor } from "./ScoringProfileEditor";
import { DEFAULT_STRATEGY_SCORE } from "@/lib/scoringPresets";
import {
  TabSettingsPanel,
  SettingsField,
  SettingsNumberInput,
  SettingsCheckbox,
  SettingsGrid,
  SettingsHints,
} from "./TabSettingsPanel";

interface Props {
  params: ScanParams;
  onChange: (params: ScanParams) => void;
  strategyScore?: StrategyScoreConfig;
  onStrategyScoreChange?: (value: StrategyScoreConfig) => void;
}

export function ContractParametersPanel({
  params,
  onChange,
  strategyScore,
  onStrategyScoreChange,
}: Props) {
  const { t, locale } = useI18n();

  const set = <K extends keyof ScanParams>(key: K, value: ScanParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const hints =
    locale === "ru"
      ? [
          `**${t("minContractPrice")}**: фильтрует контракты с ценой ниже порога (защита от bait контрактов)`,
          `**${t("maxContractMargin")}**: контракты с маржой выше этого значения скорее всего скам`,
          `**${t("minPricedRatio")}**: минимальный % предметов, которые должны иметь рыночную цену`,
          `**${t("requireHistory")}**: требовать историю торговли для более точной оценки (медленнее)`,
          `**${t("contractInstantLiquidation")}**: считать только то, что можно сразу продать в buy orders в радиусе продажи`,
          `**${t("contractHoldDays")}**: горизонт в днях для оценки вероятности полной распродажи`,
          `**${t("contractTargetConfidence")}**: минимальная вероятность полной распродажи за горизонт`,
        ]
      : [
          `**${t("minContractPrice")}**: filter contracts below this price (bait protection)`,
          `**${t("maxContractMargin")}**: contracts above this margin are likely scams`,
          `**${t("minPricedRatio")}**: minimum % of items that must have market price`,
          `**${t("requireHistory")}**: require trading history for accurate pricing (slower)`,
          `**${t("contractInstantLiquidation")}**: keep only contracts that can be sold immediately into buy orders within sell radius`,
          `**${t("contractHoldDays")}**: horizon in days for liquidation probability modeling`,
          `**${t("contractTargetConfidence")}**: minimum full-liquidation probability within the horizon`,
        ];

  return (
    <TabSettingsPanel
      title={t("contractFilters")}
      hint={t("contractFiltersHint")}
      icon="📜"
      persistKey="contracts"
      help={{
        stepKeys: [
          "helpContractsStep1",
          "helpContractsStep2",
          "helpContractsStep3",
        ],
        wikiSlug: "Contract-Arbitrage",
      }}
    >
      <SettingsGrid cols={4}>
        <SettingsField label={t("minContractPrice")}>
          <SettingsNumberInput
            value={params.min_contract_price ?? 10_000_000}
            onChange={(v) => set("min_contract_price", v)}
            min={0}
            max={10_000_000_000}
            step={1_000_000}
          />
        </SettingsField>

        <SettingsField label={t("maxContractMargin")}>
          <SettingsNumberInput
            value={params.max_contract_margin ?? 100}
            onChange={(v) => set("max_contract_margin", v)}
            min={10}
            max={500}
            step={10}
          />
        </SettingsField>

        <SettingsField label={t("minPricedRatio")}>
          <SettingsNumberInput
            value={(params.min_priced_ratio ?? 0.8) * 100}
            onChange={(v) => set("min_priced_ratio", v / 100)}
            min={50}
            max={100}
            step={5}
          />
        </SettingsField>

        <SettingsField label={t("requireHistory")}>
          <SettingsCheckbox
            checked={params.require_history ?? false}
            onChange={(v) => set("require_history", v)}
          />
        </SettingsField>

        <SettingsField label={t("contractInstantLiquidation")}>
          <SettingsCheckbox
            checked={params.contract_instant_liquidation ?? false}
            onChange={(v) => set("contract_instant_liquidation", v)}
          />
        </SettingsField>

        <SettingsField label={t("excludeRigsWithShip")}>
          <SettingsCheckbox
            checked={params.exclude_rigs_with_ship ?? true}
            onChange={(v) => set("exclude_rigs_with_ship", v)}
          />
        </SettingsField>

        <SettingsField label={t("contractHoldDays")}>
          <SettingsNumberInput
            value={params.contract_hold_days ?? 7}
            onChange={(v) => set("contract_hold_days", v)}
            min={1}
            max={180}
            step={1}
          />
        </SettingsField>

        <SettingsField label={t("contractTargetConfidence")}>
          <SettingsNumberInput
            value={params.contract_target_confidence ?? 80}
            onChange={(v) => set("contract_target_confidence", v)}
            min={10}
            max={100}
            step={5}
          />
        </SettingsField>
      </SettingsGrid>

      <ScoringProfileEditor
        value={strategyScore ?? DEFAULT_STRATEGY_SCORE}
        onChange={(next) => onStrategyScoreChange?.(next)}
        disabled={!onStrategyScoreChange}
        compact
        persistKey="score-contracts"
      />

      <SettingsHints hints={hints} />
    </TabSettingsPanel>
  );
}
