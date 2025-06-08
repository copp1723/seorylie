/**
 * External API Flags Hook
 *
 * React hook for checking and managing external API integration flags
 */

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export enum ExternalAPIFlags {
  GoogleAdsETL = "google-ads-etl",
  TwilioSMS = "twilio-sms",
  SendGridEmail = "sendgrid-email",
  OpenAIChat = "openai-chat",
  ADFIntegration = "adf-integration",
}

interface ExternalAPIFlagStatus {
  flag: ExternalAPIFlags;
  enabled: boolean;
  reason?: string;
}

interface UseExternalAPIFlagsResult {
  flags: Record<ExternalAPIFlags, boolean>;
  isLoading: boolean;
  error: string | null;
  refreshFlags: () => Promise<void>;
  enableFlag: (flag: ExternalAPIFlags) => Promise<boolean>;
  disableFlag: (flag: ExternalAPIFlags, reason: string) => Promise<boolean>;
  isFlagEnabled: (flag: ExternalAPIFlags) => boolean;
}

/**
 * Hook for managing external API integration flags
 */
export function useExternalAPIFlags(): UseExternalAPIFlagsResult {
  const [flags, setFlags] = useState<Record<ExternalAPIFlags, boolean>>(
    {} as Record<ExternalAPIFlags, boolean>,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all flags
  const refreshFlags = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get("/api/external-api-flags");

      if (response.data.success) {
        setFlags(response.data.data);
      } else {
        setError(response.data.error || "Failed to fetch external API flags");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching external API flags",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Enable a flag
  const enableFlag = useCallback(
    async (flag: ExternalAPIFlags): Promise<boolean> => {
      try {
        const response = await axios.post(
          `/api/external-api-flags/${flag}/enable`,
        );

        if (response.data.success) {
          setFlags((prev) => ({
            ...prev,
            [flag]: true,
          }));
          return true;
        } else {
          setError(response.data.error || `Failed to enable ${flag}`);
          return false;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `An error occurred while enabling ${flag}`,
        );
        return false;
      }
    },
    [],
  );

  // Disable a flag
  const disableFlag = useCallback(
    async (flag: ExternalAPIFlags, reason: string): Promise<boolean> => {
      try {
        const response = await axios.post(
          `/api/external-api-flags/${flag}/disable`,
          { reason },
        );

        if (response.data.success) {
          setFlags((prev) => ({
            ...prev,
            [flag]: false,
          }));
          return true;
        } else {
          setError(response.data.error || `Failed to disable ${flag}`);
          return false;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `An error occurred while disabling ${flag}`,
        );
        return false;
      }
    },
    [],
  );

  // Check if a flag is enabled
  const isFlagEnabled = useCallback(
    (flag: ExternalAPIFlags): boolean => {
      return flags[flag] === true;
    },
    [flags],
  );

  // Fetch flags on mount
  useEffect(() => {
    refreshFlags();
  }, [refreshFlags]);

  return {
    flags,
    isLoading,
    error,
    refreshFlags,
    enableFlag,
    disableFlag,
    isFlagEnabled,
  };
}

export default useExternalAPIFlags;
