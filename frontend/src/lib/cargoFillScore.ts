export type CargoFillScoreInput = {
  cargoFillRatio: number;
  iskPerJump: number;
  expectedProfitIsk: number;
  capitalEfficiency: number;
  confidencePercent: number;
  executionQuality: number;
  riskPenalty: number;
  slippagePenalty: number;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function scaledLog(value: number, maxReference: number): number {
  if (!(value > 0) || !(maxReference > 0)) return 0;
  return clamp(Math.log10(1 + value) / Math.log10(1 + maxReference), 0, 1);
}

export function computeCargoFillScore(input: CargoFillScoreInput): number {
  const cargoFill = clamp(input.cargoFillRatio, 0, 1);
  const iskPerJump = scaledLog(Math.max(0, input.iskPerJump), 250_000_000);
  const expectedProfit = scaledLog(Math.max(0, input.expectedProfitIsk), 2_000_000_000);
  const capitalEfficiency = clamp(input.capitalEfficiency, 0, 1);
  const confidence = clamp(input.confidencePercent / 100, 0, 1);
  const execution = clamp(input.executionQuality / 100, 0, 1);
  const riskPenalty = clamp(input.riskPenalty, 0, 1);
  const slippagePenalty = clamp(input.slippagePenalty, 0, 1);

  const score =
    cargoFill * 0.3 +
    iskPerJump * 0.2 +
    expectedProfit * 0.15 +
    capitalEfficiency * 0.08 +
    confidence * 0.12 +
    execution * 0.15 -
    riskPenalty * 0.16 -
    slippagePenalty * 0.12;

  return clamp(score * 100, 0, 100);
}
