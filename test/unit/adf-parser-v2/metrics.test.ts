// ADF Metrics Test Suite

import {
  recordSuccess,
  recordError,
  recordDuration,
} from "../../../server/observability/metrics";

describe("ADF Metrics Functions", () => {
  it("recordSuccess should not throw", () => {
    expect(() => recordSuccess("test_metric", "test_service")).not.toThrow();
  });

  it("recordError should not throw", () => {
    expect(() => recordError("test_error", "test_component")).not.toThrow();
  });

  it("recordDuration should not throw", () => {
    expect(() => recordDuration("test_metric", 123)).not.toThrow();
  });
});
