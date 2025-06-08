#!/usr/bin/env tsx

/**
 * Gradual SendGrid Migration Setup Script
 *
 * This script helps you migrate to SendGrid webhooks safely without downtime.
 * It sets up parallel processing and allows per-dealership migration.
 */

import { config } from "dotenv";
config();

import readline from "readline";
import fs from "fs";
import path from "path";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

interface MigrationConfig {
  sendgridApiKey?: string;
  webhookSecret?: string;
  migrationMode: "test" | "parallel" | "gradual" | "complete";
  enabledDealerships: string[];
  webhookUrl?: string;
}

class SendGridMigrationSetup {
  private config: MigrationConfig = {
    migrationMode: "test",
    enabledDealerships: [],
  };

  async run() {
    console.log("🚀 SendGrid Migration Setup");
    console.log("================================\n");

    console.log("This script will help you migrate to SendGrid safely.");
    console.log(
      "You can migrate gradually without affecting your current email processing.\n",
    );

    await this.gatherConfiguration();
    await this.updateEnvironmentVariables();
    await this.generateMigrationPlan();
    await this.setupWebhookEndpoint();

    console.log("\n✅ SendGrid migration setup complete!");
    console.log("\n📋 Next Steps:");
    console.log("1. Start your server to enable the new webhook endpoint");
    console.log("2. Configure SendGrid inbound parse (instructions provided)");
    console.log("3. Test with a single dealership first");
    console.log("4. Gradually migrate more dealerships");

    rl.close();
  }

  private async gatherConfiguration() {
    console.log("📝 Configuration Setup\n");

    // SendGrid API Key
    const apiKey = await this.promptUser("Enter your SendGrid API Key: ");
    this.config.sendgridApiKey = apiKey;

    // Webhook Secret
    const secret = await this.promptUser(
      "Enter webhook verification secret (or press Enter to generate): ",
    );
    this.config.webhookSecret = secret || this.generateWebhookSecret();

    // Migration mode
    console.log("\nMigration Modes:");
    console.log("1. test - Test webhook with development emails only");
    console.log("2. parallel - Run both systems, compare results");
    console.log("3. gradual - Migrate specific dealerships one by one");
    console.log("4. complete - Full migration (advanced)");

    const mode = await this.promptUser("Select migration mode (1-4): ");
    const modes = ["test", "parallel", "gradual", "complete"];
    this.config.migrationMode = (modes[parseInt(mode) - 1] as any) || "test";

    // Webhook URL
    const defaultUrl = "https://yourdomain.com/api/sendgrid/webhook/inbound";
    this.config.webhookUrl =
      (await this.promptUser(`Webhook URL (${defaultUrl}): `)) || defaultUrl;

    console.log("\n✅ Configuration gathered successfully");
  }

  private async updateEnvironmentVariables() {
    console.log("\n📄 Updating Environment Variables...");

    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";

    // Read existing .env file
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    // Add SendGrid configuration
    const sendgridConfig = `
# SendGrid Configuration (Migration)
SENDGRID_API_KEY=${this.config.sendgridApiKey}
SENDGRID_WEBHOOK_SECRET=${this.config.webhookSecret}
SENDGRID_WEBHOOK_ENABLED=true
SENDGRID_VERIFICATION_ENABLED=true

# Email Migration Settings
EMAIL_PROCESSOR=${this.config.migrationMode === "complete" ? "sendgrid" : "legacy"}
EMAIL_ROUTING_LOGGING=true
EMAIL_COMPARISON_MODE=${this.config.migrationMode === "parallel" ? "true" : "false"}

# Legacy email system (keep enabled during migration)
LEGACY_EMAIL_ENABLED=true
`;

    // Check if SendGrid config already exists
    if (envContent.includes("SENDGRID_API_KEY")) {
      console.log("⚠️  SendGrid configuration already exists in .env file");
      const update = await this.promptUser(
        "Update existing configuration? (y/n): ",
      );

      if (update.toLowerCase() === "y") {
        // Update existing configuration
        envContent = this.updateExistingEnvConfig(envContent, sendgridConfig);
      }
    } else {
      // Append new configuration
      envContent += sendgridConfig;
    }

    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    console.log("✅ Environment variables updated");
  }

  private updateExistingEnvConfig(
    envContent: string,
    newConfig: string,
  ): string {
    // Remove existing SendGrid config lines
    const lines = envContent.split("\n");
    const filteredLines = lines.filter(
      (line) =>
        !line.startsWith("SENDGRID_") &&
        !line.startsWith("EMAIL_PROCESSOR") &&
        !line.startsWith("EMAIL_ROUTING_") &&
        !line.startsWith("EMAIL_COMPARISON_") &&
        !line.startsWith("LEGACY_EMAIL_"),
    );

    return filteredLines.join("\n") + newConfig;
  }

  private async generateMigrationPlan() {
    console.log("\n📋 Generating Migration Plan...");

    const planContent = `# SendGrid Migration Plan - ${new Date().toISOString()}

## Configuration
- Migration Mode: ${this.config.migrationMode}
- Webhook URL: ${this.config.webhookUrl}
- Comparison Mode: ${this.config.migrationMode === "parallel" ? "Enabled" : "Disabled"}

## Phase 1: Setup (Current)
✅ SendGrid API key configured
✅ Webhook endpoint created
✅ Security verification enabled
⏳ DNS configuration pending

## Phase 2: Testing
- [ ] Configure SendGrid inbound parse
- [ ] Send test email to webhook endpoint
- [ ] Verify ADF processing works correctly
- [ ] Check logs for any errors

## Phase 3: Gradual Migration
${this.generateDealershipMigrationChecklist()}

## Rollback Plan
If issues occur:
1. Set SENDGRID_WEBHOOK_ENABLED=false
2. Verify legacy email processing is working
3. Check logs for specific error messages
4. Contact support if needed

## DNS Configuration Required

### MX Records for SendGrid
\`\`\`
# Add these MX records to your domain
Priority: 10
Host: mail.yourdomain.com
Points to: mx.sendgrid.net
\`\`\`

### Webhook Configuration
1. Go to SendGrid → Settings → Inbound Parse
2. Add new hostname: mail.yourdomain.com
3. Set URL: ${this.config.webhookUrl}
4. Enable spam check: Recommended
5. Send raw email: Enabled

## Testing Commands
\`\`\`bash
# Check webhook status
curl https://yourdomain.com/api/sendgrid/health

# Test email processing (after DNS setup)
# Send email with ADF XML attachment to: test@mail.yourdomain.com

# Monitor logs
npm run dev  # Watch for SendGrid webhook processing logs
\`\`\`
`;

    const planPath = path.join(
      process.cwd(),
      "docs",
      "sendgrid-migration-progress.md",
    );
    fs.writeFileSync(planPath, planContent);
    console.log(`✅ Migration plan saved to: ${planPath}`);
  }

  private generateDealershipMigrationChecklist(): string {
    const dealerships = [
      "kunes-rv-fox-valley",
      "kunes-rv-freedom",
      "kunes-rv-elkhorn",
      "kunes-rv-frankfort",
      "kunes-rv-green-bay",
      "kunes-rv-lacrosse",
      "kunes-rv-lake-mills",
      "kunes-rv-super-center",
      "kunes-rv-sterling",
      "kunes-wisconsin-rv-world",
      "kunes-rv-wisconsin-rapids",
    ];

    return dealerships
      .map(
        (dealership) =>
          `- [ ] ${dealership} (crm_${dealership}@localwerksmail.com)`,
      )
      .join("\n");
  }

  private async setupWebhookEndpoint() {
    console.log("\n🔗 Setting up Webhook Endpoint...");

    // Check if webhook route already exists
    const webhookRoutePath = path.join(
      process.cwd(),
      "server",
      "routes",
      "sendgrid-webhook-routes.ts",
    );

    if (fs.existsSync(webhookRoutePath)) {
      console.log("✅ Webhook route already exists");
    } else {
      console.log(
        "⚠️  Webhook route not found - you may need to add it to your server",
      );
    }

    // Add route to main server if needed
    const serverIndexPath = path.join(process.cwd(), "server", "index.ts");
    if (fs.existsSync(serverIndexPath)) {
      const serverContent = fs.readFileSync(serverIndexPath, "utf8");

      if (!serverContent.includes("sendgrid-webhook-routes")) {
        console.log("📝 Note: Add the following to your server/index.ts:");
        console.log("");
        console.log(
          "import sendgridRoutes from './routes/sendgrid-webhook-routes';",
        );
        console.log("app.use('/api/sendgrid', sendgridRoutes);");
        console.log("");
      } else {
        console.log("✅ Webhook route already integrated in server");
      }
    }
  }

  private generateWebhookSecret(): string {
    return require("crypto").randomBytes(32).toString("hex");
  }

  private promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

// Run the setup
const setup = new SendGridMigrationSetup();
setup.run().catch(console.error);
