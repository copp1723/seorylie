/**
 * External API Flags Manager Component
 *
 * Admin interface for managing external API integration flags
 */

import React, { useState } from "react";
import useExternalAPIFlags, {
  ExternalAPIFlags,
} from "../../hooks/useExternalAPIFlags";

interface ExternalAPIFlagProps {
  flag: ExternalAPIFlags;
  enabled: boolean;
  onEnable: () => Promise<void>;
  onDisable: (reason: string) => Promise<void>;
}

const ExternalAPIFlag: React.FC<ExternalAPIFlagProps> = ({
  flag,
  enabled,
  onEnable,
  onDisable,
}) => {
  const [reason, setReason] = useState<string>("");
  const [showReasonInput, setShowReasonInput] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleToggle = async () => {
    if (enabled) {
      setShowReasonInput(true);
    } else {
      setIsSubmitting(true);
      await onEnable();
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    await onDisable(reason);
    setShowReasonInput(false);
    setReason("");
    setIsSubmitting(false);
  };

  const cancelDisable = () => {
    setShowReasonInput(false);
    setReason("");
  };

  // Format flag name for display
  const formatFlagName = (flag: string): string => {
    return flag
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="border rounded-md p-4 mb-4 bg-white shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">{formatFlagName(flag)}</h3>
          <p className="text-sm text-gray-500">{flag}</p>
        </div>
        <div className="flex items-center">
          <span
            className={`inline-block w-3 h-3 rounded-full mr-2 ${enabled ? "bg-green-500" : "bg-red-500"}`}
          ></span>
          <span
            className={`text-sm ${enabled ? "text-green-600" : "text-red-600"}`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            onClick={handleToggle}
            disabled={isSubmitting || showReasonInput}
            className={`ml-4 px-3 py-1 rounded text-sm ${
              enabled
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            } disabled:opacity-50`}
          >
            {enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {showReasonInput && (
        <div className="mt-4 border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for disabling (required)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded-md p-2 text-sm"
            rows={2}
            placeholder="Please provide a reason for disabling this integration"
          />
          <div className="mt-2 flex justify-end space-x-2">
            <button
              onClick={cancelDisable}
              className="px-3 py-1 border rounded text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleDisable}
              disabled={!reason.trim() || isSubmitting}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm disabled:opacity-50"
            >
              Confirm Disable
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ExternalAPIFlagsManager: React.FC = () => {
  const { flags, isLoading, error, refreshFlags, enableFlag, disableFlag } =
    useExternalAPIFlags();

  const handleEnable = async (flag: ExternalAPIFlags) => {
    const success = await enableFlag(flag);
    if (success) {
      await refreshFlags();
    }
  };

  const handleDisable = async (flag: ExternalAPIFlags, reason: string) => {
    const success = await disableFlag(flag, reason);
    if (success) {
      await refreshFlags();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          External API Integrations
        </h2>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          External API Integrations
        </h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
          <button onClick={refreshFlags} className="mt-2 text-sm underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">External API Integrations</h2>
        <button
          onClick={refreshFlags}
          className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100"
        >
          Refresh
        </button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              These settings control the availability of external API
              integrations. Disabling an integration will prevent the system
              from making calls to that external service.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(flags).map(([flag, enabled]) => (
          <ExternalAPIFlag
            key={flag}
            flag={flag as ExternalAPIFlags}
            enabled={enabled}
            onEnable={() => handleEnable(flag as ExternalAPIFlags)}
            onDisable={(reason) =>
              handleDisable(flag as ExternalAPIFlags, reason)
            }
          />
        ))}
      </div>
    </div>
  );
};

export default ExternalAPIFlagsManager;
