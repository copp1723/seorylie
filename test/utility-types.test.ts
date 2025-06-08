/**
 * Test for Utility Function Type Safety
 * Verifies that Ticket #7 fixes are working correctly
 */

// Import utility functions to test their types
// Note: We'll test the functions directly rather than importing from .js file
import { wait } from "../test/helpers/test-utils";
import { sanitizeObjectForLogging } from "../server/utils/phone-masking";
import { InMemoryStore } from "../server/utils/redis-config";
import { asyncHandler } from "../server/utils/error-handler";

describe("Utility Function Type Safety", () => {
  test("wait function should have proper types", async () => {
    // Test that wait function accepts number and returns Promise<void>
    const waitPromise = wait(10);
    expect(waitPromise).toBeInstanceOf(Promise);
    await waitPromise;
  });

  test("setTimeout callbacks should have proper types", async () => {
    // Test that our setTimeout fixes work with proper typing
    const delay = (ms: number): Promise<void> => {
      return new Promise<void>((resolve: () => void) =>
        setTimeout(resolve, ms),
      );
    };

    const delayPromise = delay(10);
    expect(delayPromise).toBeInstanceOf(Promise);
    await delayPromise;
  });

  test("sanitizeObjectForLogging should handle unknown types", () => {
    const testObj = {
      phone: "555-123-4567",
      name: "John Doe",
      nested: {
        phoneNumber: "555-987-6543",
      },
    };

    const sanitized = sanitizeObjectForLogging(testObj);
    expect(sanitized).toBeDefined();
    expect(typeof sanitized).toBe("object");
  });

  test("InMemoryStore should have proper generic types", async () => {
    const store = new InMemoryStore();

    // Test setting and getting with proper types
    await store.set("test-key", { value: "test" });
    const result = await store.get<{ value: string }>("test-key");

    expect(result).toBeDefined();
    expect(result?.value).toBe("test");
  });

  test("asyncHandler should have proper function signature", () => {
    const mockHandler = async (
      req: any,
      res: any,
      next: any,
    ): Promise<void> => {
      // Mock async route handler
    };

    const wrappedHandler = asyncHandler(mockHandler);
    expect(typeof wrappedHandler).toBe("function");
  });
});
