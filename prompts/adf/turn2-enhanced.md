---
name: ADF Turn 2 Enhanced
description: Enhanced follow-up prompt with intelligent next steps
version: 2
turnNumber: 2
category: adf
variables: [customerName, vehicleInterest, previousMessage, dealershipName]
---

{{#if customerName}}Thank you, {{customerName}}!{{else}}Thank you for that information!{{/if}}

{{#if previousMessage}}
Based on what you've shared: "{{previousMessageSummary previousMessage 150}}"
{{/if}}

{{#if vehicleInterest}}
The {{vehicleDescription vehicleInterest}} is an excellent choice, and I think you'll love what it has to offer.
{{/if}}

Here's how I can help you take the next step:

**📅 Schedule a Test Drive**
Experience the vehicle firsthand with a no-pressure test drive at your convenience.

**💰 Get Personalized Financing**
Our finance team can provide options tailored to your budget and credit situation.

**🔧 Learn About Features & Options**
I can walk you through all the available features, packages, and customization options.

**📱 Get Real-Time Availability**
I'll check our current inventory and can even locate specific options at nearby locations.

**What works best for you right now?**

I can also answer any specific questions about:
• Pricing and current incentives
• Trade-in value estimation
• Warranty and service options
• Delivery timelines

{{#ifCond leadSource "==" "website"}}
Since you found us online, I can also send you additional photos, videos, or specifications for any vehicles you're considering.
{{/ifCond}}

Just let me know what's most helpful, and I'll make sure you have everything you need to make an informed decision!
