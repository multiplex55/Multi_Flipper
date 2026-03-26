import type { UpdateCheckStatus } from "./api";

export type UpdatePollEvaluation = {
  shouldReload: boolean;
  sawDisconnect: boolean;
};

function normalizeVersionToken(value: string | undefined): string {
  const trimmed = (value || "").trim();
  if (trimmed === "") return "";
  const withoutV = trimmed.replace(/^[vV]/, "");
  const buildMetadataIndex = withoutV.indexOf("+");
  return buildMetadataIndex >= 0
    ? withoutV.slice(0, buildMetadataIndex).trim()
    : withoutV.trim();
}

export async function evaluateUpdatePoll(
  getStatus: () => Promise<UpdateCheckStatus>,
  previousDisconnect: boolean,
  expectedVersion?: string,
): Promise<UpdatePollEvaluation> {
  try {
    const status = await getStatus();
    const noPendingUpdate = !status.has_update && !status.check_error;
    const expected = normalizeVersionToken(expectedVersion);
    const current = normalizeVersionToken(status.current_version);
    const reachedExpectedVersion = expected !== "" && current !== "" && expected === current;

    return {
      shouldReload: previousDisconnect || noPendingUpdate || reachedExpectedVersion,
      sawDisconnect: previousDisconnect,
    };
  } catch {
    return {
      shouldReload: false,
      sawDisconnect: true,
    };
  }
}
