import { generateResponse } from "../../server/services/ai-service";

describe("AI Service", () => {
  test("returns fallback when API key missing", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const resp = await generateResponse("hello");
    expect(resp).toBe("AI service unavailable");
    if (original) process.env.OPENAI_API_KEY = original;
  });
});
