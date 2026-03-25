import { useEffect, useState } from "react";
import { getUpdateCheckStatus } from "./api";

interface UseVersionCheckReturn {
  appVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  dismissedForSession: boolean;
  autoUpdateSupported: boolean;
  platform: string;
  releaseURL: string | null;
  checkError: string | null;
  checking: boolean;
}

/**
 * Checks backend update status on mount and exposes current/latest versions.
 */
export function useVersionCheck(): UseVersionCheckReturn {
  const fallbackAppVersion: string = import.meta.env.VITE_APP_VERSION || "dev";
  const [appVersion, setAppVersion] = useState(fallbackAppVersion);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const [autoUpdateSupported, setAutoUpdateSupported] = useState(false);
  const [platform, setPlatform] = useState("");
  const [releaseURL, setReleaseURL] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const data = await getUpdateCheckStatus();
        if (controller.signal.aborted) return;
        setAppVersion(data.current_version || fallbackAppVersion);
        setLatestVersion(data.latest_version ?? null);
        setHasUpdate(!!data.has_update);
        setDismissedForSession(!!data.dismissed_for_session);
        setAutoUpdateSupported(!!data.auto_update_supported);
        setPlatform(data.platform || "");
        setReleaseURL(data.release_url ?? null);
        setCheckError(data.check_error ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setCheckError(err instanceof Error ? err.message : "Failed to check updates");
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    })();
    return () => controller.abort();
  }, [fallbackAppVersion]);

  return {
    appVersion,
    latestVersion,
    hasUpdate,
    dismissedForSession,
    autoUpdateSupported,
    platform,
    releaseURL,
    checkError,
    checking,
  };
}
