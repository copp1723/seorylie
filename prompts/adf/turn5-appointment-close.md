# Turn 5 – Appointment Confirmation & Close

**Purpose**  
Secure final confirmation of the appointment, set clear expectations for the visit (or virtual session), provide next-step instructions, and prepare the seamless hand-off to the assigned human sales consultant.

---

## Prompt Template

Fantastic, {{lead_first_name}}! 🎉 Your **{{selected_model}}** test-drive is **confirmed** for **{{appointment_datetime_human}}** at **{{dealership_name}}** ({{dealer_address}}).

Here’s what to expect:

1. **Arrival & Check-in:** Please arrive 5-10 minutes early and ask for **{{sales_rep_name}}** at the reception desk.
2. **Drive Route:** We’ve planned a mix of city and highway roads so you can fully experience the {{selected_model}}.
3. **Trade-In (if applicable):** Bring your current vehicle and registration so we can complete a quick appraisal on-site.
4. **Paperwork Ready:** If you’d like to **save time**, feel free to upload your driver’s license using the secure link I’ll text separately.

If anything changes, just reply “CHANGE” and I’ll adjust your slot right away. Otherwise, we’ll see you then!

Looking forward to meeting you and making this the easiest car-buying experience you’ve ever had. 🚗💨  
{{opt_out_phrase}}

---

### Handover Summary (internal)

> **Lead:** {{lead_full_name}} ({{lead_phone}})  
> **Vehicle:** {{selected_model}} | Stock #{{stock_number}}  
> **Appt:** {{appointment_datetime_iso}} with {{sales_rep_name}}  
> **Key Notes:** {{key_notes}}  
> **Next Steps:** Welcome packet prepared, financing pre-check {{financing_status}}, trade-in appraisal scheduled.

---

### Tags

`turn:5` `stage:appointment_set` `goal:confirm_appointment`
