# Open items / blockers — do not silently assume

| Item | Why it matters | Recommended treatment |
|---|---|---|
| Jobber scheduling API availability/reservation | Core booking confirmation relies on it | Prove via schema and test. Otherwise pending/manual Jobber approval |
| Jobber app eligibility for private integration | Some private custom use may need Jobber approval | Confirm in Developer Center or with Jobber API support |
| Actual business timezone | Booking/notifications/reminders | Discover in Jobber account, do not assume New York |
| Non-emergency 2-hour buffer definition | Could mean lead time vs between jobs vs before/after | Confirm with Septic Tank Man; no coding assumption |
| Service types & durations | Needed for available slots & Jobber line items | Inventory Jobber Products/Services, verify actual scheduling config |
| Emergency service rules | Different lead time/after-hours policy | Keep emergency auto-book OFF until separate design |
| Jobber 'job creation' vs scheduled visit | Creating job may not reserve technician time | Verify atomicity/scheduling semantics; confirm via visit |
| GHL calendar used by Voice AI | GHL may be independently bookable | Identify calendar(s), prevent early confirmation notifications |
| Stage IDs and review workflow details | Unintended pipeline triggers | Discover in Septic Tank Man sub-account; test no duplicate |
| Existing GHL automations | Contact/opportunity creations can trigger workflows | Audit all relevant triggers before live writes |
| Message consent and review frequency | Per-job request still subject to opt-out/regulation | Validate preferences and service's desired repeat cadence |
| Historical import cutoff/delivery | All records including old job dates | Inventory available API history; user approves date ranges and no-message migration |
| AI summary generation hook | Trigger might vary by GHL setup | Identify GHL events and safe Jobber note mutation |
| Multi-property customers | Services may occur at different addresses | Link each Jobber property explicitly |
| Owner approvals for live writes/deployment | Business sensitive | Request explicit confirmation before irreversible changes |
| Queue provider/cost | Durable processing needed | Compare QStash vs approved alternative; choose after cost assessment |
| How to handle GHL-only customer edit | Jobber is master, but user may need to save edit | Apply to Jobber via authorized adapter then re-read; if failure leave pending |

**Do not add new user-facing configuration questions for defaults that can be discovered read-only via APIs.** Escalate only choices that materially change business outcomes.
