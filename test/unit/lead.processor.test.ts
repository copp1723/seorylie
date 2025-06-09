import { processLead } from "../../server/services/lead.processor";
import db from "../../server/db";
import { leads } from "../../shared/index";

describe("Lead Processor", () => {
  test("throws error for non-existent lead", async () => {
    await expect(processLead(999999)).rejects.toThrow("Lead not found");
  });
});
