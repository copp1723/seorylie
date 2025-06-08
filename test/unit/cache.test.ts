/**
 * Unit tests for the cache utility
 */
import { describe, beforeEach, test, expect, jest } from "@jest/globals";
import {
  getFromCache,
  setInCache,
  removeFromCache,
  clearAllCache,
  getCacheStats,
  clearNamespaceCache,
} from "../../server/utils/cache";

describe("Cache Utility", () => {
  beforeEach(() => {
    // Reset the cache before each test
    clearAllCache();
  });

  test("should store and retrieve values", () => {
    // Arrange
    const key = "test-key";
    const value = { name: "Test Value", id: 123 };

    // Act
    setInCache(key, value);
    const retrieved = getFromCache(key);

    // Assert
    expect(retrieved).toEqual(value);
  });

  test("should handle TTL expiration", () => {
    // Arrange
    jest.useFakeTimers();
    const key = "expiring-key";
    const value = "will expire";

    // Act - set with a 10ms TTL
    setInCache(key, value, 10);

    // Assert - immediately available
    expect(getFromCache(key)).toEqual(value);

    // Fast-forward time past expiration
    jest.advanceTimersByTime(20);

    // Should be gone after expiration
    expect(getFromCache(key)).toBeNull();

    // Cleanup
    jest.useRealTimers();
  });

  test("should delete keys", () => {
    // Arrange
    const key = "delete-me";
    const value = "to be deleted";

    // Act
    setInCache(key, value);
    removeFromCache(key);

    // Assert
    expect(getFromCache(key)).toBeNull();
  });

  test("should use namespaces correctly", () => {
    // Arrange
    const key = "shared-key";
    const value1 = "value in namespace 1";
    const value2 = "value in namespace 2";

    // Act
    setInCache(key, value1, undefined, "ns1");
    setInCache(key, value2, undefined, "ns2");

    // Assert - each namespace has its own copy
    expect(getFromCache(key, "ns1")).toEqual(value1);
    expect(getFromCache(key, "ns2")).toEqual(value2);

    // Deleting from one namespace doesn't affect the other
    removeFromCache(key, "ns1");
    expect(getFromCache(key, "ns1")).toBeNull();
    expect(getFromCache(key, "ns2")).toEqual(value2);
  });

  test("should provide valid cache statistics", () => {
    // Arrange
    setInCache("stats-test-1", "value1");
    setInCache("stats-test-2", "value2");
    setInCache("stats-test-3", "value3", 100);

    // Act
    const stats = getCacheStats();

    // Assert
    expect(stats).toHaveProperty("size");
    expect(stats.size).toBe(3);
    expect(stats).toHaveProperty("hits");
    expect(stats).toHaveProperty("misses");
    expect(stats).toHaveProperty("hitRate");
  });

  test("should clear all cache contents", () => {
    // Arrange
    setInCache("clear-test-1", "value1");
    setInCache("clear-test-2", "value2", undefined, "custom-ns");

    // Act
    clearAllCache();

    // Assert
    expect(getFromCache("clear-test-1")).toBeNull();
    expect(getFromCache("clear-test-2", "custom-ns")).toBeNull();
    expect(getCacheStats().size).toBe(0);
  });

  test("should clear namespace contents", () => {
    // Arrange
    setInCache("ns-test-1", "value1", undefined, "test-ns");
    setInCache("ns-test-2", "value2", undefined, "test-ns");
    setInCache("regular-key", "value3"); // Not in namespace

    // Act
    const clearedCount = clearNamespaceCache("test-ns");

    // Assert
    expect(clearedCount).toBe(2);
    expect(getFromCache("ns-test-1", "test-ns")).toBeNull();
    expect(getFromCache("ns-test-2", "test-ns")).toBeNull();
    expect(getFromCache("regular-key")).toEqual("value3"); // Should still exist
  });
});
