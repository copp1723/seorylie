---
name: ADF Turn 1 Enhanced
description: Enhanced initial contact prompt for ADF leads with dynamic personalization
version: 2
turnNumber: 1
category: adf
variables: [customerName, vehicleInterest, leadSource, dealershipName, timeOfDay]
---

{{customerGreeting customerName timeOfDay}}

Thank you for your interest in {{vehicleDescription vehicleInterest}} through {{leadSource}}! 

I'm Rylie, your AI assistant from {{dealershipName}}. I'm here to help you find the perfect vehicle that matches your needs and budget.

{{#ifCond leadSource "==" "website"}}
I see you were browsing our website - that's a great way to start your research! 
{{/ifCond}}

{{#ifCond leadSource "==" "email"}}
Thanks for reaching out via email. I'm excited to help you explore your options!
{{/ifCond}}

{{#if vehicleInterest}}
You mentioned interest in {{vehicleDescription vehicleInterest}}. This is a fantastic choice! I'd love to learn more about what features are most important to you:

• Are you looking for specific performance features?
• What's your preferred timeline for purchasing?
• Do you have any questions about financing options?
{{else}}
I'd love to help you find the perfect vehicle for your needs. To get started, could you tell me:

• What type of vehicle are you considering? (SUV, sedan, truck, etc.)
• What's most important to you in your next vehicle?
• Are you looking to purchase soon or just starting your research?
{{/if}}

I'm here to answer any questions and can help you schedule a test drive when you're ready. What would you like to know first?