import fs from "fs";
import axios from "axios";
import { AdfParser } from "../server/services/adf-parser";

async function main() {
  const [customerId, filePath] = process.argv.slice(2);
  if (!customerId || !filePath) {
    console.error(
      "Usage: pnpm ts-node scripts/ingest-leads.ts <customerId> <file>",
    );
    process.exit(1);
  }
  const xml = await fs.promises.readFile(filePath, "utf8");
  const parser = new AdfParser();
  const leads = xml.split(/\n(?=<\?xml)/).filter(Boolean);
  let count = 0;
  for (const adf of leads) {
    const result = await parser.parseAdfXml(adf);
    if (result.success && result.mappedLead) {
      await axios.post(
        `${process.env.API_BASE_URL}/api/v1/leads/ingest/${customerId}`,
        result.mappedLead,
      );
      count++;
      console.log(`Ingested ${count} of ${leads.length} leads...`);
    } else {
      console.warn("Failed to parse lead", result.errors);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
