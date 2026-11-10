\# SyncBridge GPT handoff — status as of 2026-11-10



\*\*Audience:\*\* another coding agent / GPT continuing this project. &#x20;

\*\*Do not expand scope.\*\* Stay Jobber ↔ GHL only. Do not invent availability, do not enable production writes without explicit gates.



\*\*Live production URL:\*\* \`https\://stmsyncbridge.vercel.app\` &#x20;

\*\*GitHub:\*\* \`https\://github.com/alyanmr738-cyber/stm_syncbridge\` (\`main\`) &#x20;

\*\*Local workspace:\*\* \`/Users/suniya/Desktop/email/syncbridge\` &#x20;

\*\*Original spec package:\*\* \`/Users/suniya/Desktop/email/Septic_Tank_Man_Cursor_Package/\`



\---



\## 1. What this product is



\*\*SyncBridge\*\* is an internal admin control center for \*\*All Access Digital\*\* only. It two-way-syncs:



\| System | Authority |

\|--------|-----------|

\| \*\*Jobber\*\* | Customers, properties, jobs, visits/scheduling, quotes, invoices, completion |

\| \*\*GoHighLevel (GHL)\*\* | Lead source, pipeline, AI/comms, review *\*workflows\** |



Middleware: \*\*Next.js 15 App Router (TypeScript) on Vercel\*\* + \*\*dedicated Supabase Postgres\*\*. Not Zapier-as-source-of-truth.



\*\*Client:\*\* Septic Tank Man. \*\*Never\*\* reuse Arizona Sign Company GHL IDs/tokens.



\### Locked business rules (do not change)



\- Confirm appointments in GHL \*\*only after Jobber\*\* has a verified schedule.

\- If Jobber API cannot reserve slots → \`pending_jobber_confirmation\`. Never fake confirmation.

\- Reschedule / extra visit → \*\*reuse Jobber job\*\*, update visit. No duplicate jobs.

\- Reviews: \*\*one per completed Jobber job\*\* (not visit-only), ledger-keyed; historical import must not send reviews.

\- Jobber wins customer/property conflicts. GHL edits go to Jobber then re-read Jobber.

\- Emergency auto-book \*\*OFF\*\*.

\- Scheduling buffers (lead time, between visits, travel) are \*\*independent knobs\*\*; do not apply a silent 2-hour default.

\- Three \*\*independent\*\* production gates: \*\*A writes\*\*, \*\*B historical backfill\*\*, \*\*C customer messaging\*\*.



Full spec: \`docs/01_DECISIONS.md\`, \`docs/ARCHITECTURE_DECISIONS_2026-11-10.md\`, \`CURSOR_MASTER_PROMPT.md\` in the ZIP package.



\---



\## 2. Current live connection state (verified in UI)



\*\*Settings → Connections\*\* (production, 2026-11-10):



\- \*\*Supabase:\*\* connected · schema applied.

\- \*\*Jobber:\*\* OAuth connected. Account name \*\*Septic Tank Man\*\*. Encoded account ID starts \`Z2lkOi8vSm9iYmVyL0FjY291bnQv…\`. Access token expires \~1 hour after connect.

\- \*\*GHL:\*\* PIT connected. Name \*\*Septic Tank Man\*\*. Location ID \`p7HYMD0h2RScLKL68uj0\`. Timezone \*\*\`America/New_York\`\*\*.



Admin login: allowlist email \`info\@allaccessdigital.net\` (password only in Vercel / \`.env.local\` — \*\*never put secrets in chat or this file\*\*).



\*\*Vercel note:\*\* Early 404s were \*\*domain + Deployment Protection\*\*, not a bad GitHub tree. Repo root \*\*is\*\* the Next.js app. Production must be \*\*public\*\* for Jobber OAuth/webhooks. \`APP_BASE_URL\` and Jobber callback must be \`https\://stmsyncbridge.vercel.app\`.



\---



\## 3. Stack



\- Next.js \*\*15.5.29\*\* (CVE-2025-66478 patched; Vercel rejected 15.2.x)

\- React 19, Tailwind 3, Inter font

\- \`iron-session\` admin cookies

\- \`@supabase/supabase-js\` service role (server only)

\- Zod env parsing

\- Vitest (small suite: flags, pending booking, audit shape)

\- \`vercel.json\` pins \`framework: nextjs\`, \`buildCommand: next build\`

\- \`next.config.ts\` sets \`outputFileTracingRoot\` to the app dir (avoid picking a parent lockfile)



\---



\## 4. UI (admin-only, wireframe-aligned)



\*\*Design:\*\* calm desktop-first. Canvas \`#f6f8fa\`, cards white, radius 14px, borders \`#e1e8ec\`, brand mark \`#1c4454\` with “S”, green “Discovery” pill, OFF pills \`#eff1f3\`, Available/ON \`#e9f5ef\` / \`#267651\`, amber pending dots \`#d49b35\`. Reference: package \`reference/dashboard_wireframe.html\`.



\*\*Chrome (\`src/components/admin/shell.tsx\` + \`nav-links.tsx\`):\*\*

\- Header: SyncBridge / Septic Tank Man · All Access Digital

\- Nav: Overview, Activity, Customers, Bookings, Reviews, Settings (active tab bold \`#1d4654\`)

\- Discovery badge + Sign out

\- Settings subnav: Connections | Mappings | Audit



\*\*Routes:\*\*



\| Path | Status | What it shows |

\|------|--------|----------------|

\| \`/login\` | Working | Email/password; allowlist + bootstrap password |

\| \`/\` | Redirect | → \`/overview\` (middleware requires login) |

\| \`/overview\` | Working | 4 tiles (connections/audit/gates/timezone), activity feed, sync control switches (read-only flags), approval gates, scheduling policy (lead/buffer/travel unset → auto scheduling off) |

\| \`/activity\` | Scaffold | Empty until events persist; in-memory inbox on single instance |

\| \`/links\` | Placeholder | Customer/job identity matcher — copy only |

\| \`/bookings\` | Placeholder | Last mock booking resolution JSON |

\| \`/reviews\` | Placeholder | Per-job review ledger copy |

\| \`/conflicts\` | Placeholder | GHL vs Jobber conflict queue copy |

\| \`/settings/connections\` | \*\*Live\*\* | Supabase / Jobber OAuth Connect / GHL PIT status |

\| \`/settings/mappings\` | Working | Table from \`spec/field_mapping.csv\` |

\| \`/settings/audit\` | Working | Capability matrix from mocks + architecture rows; \*\*not yet live GraphQL/GHL inventory\*\* |



\*\*Overview tiles\*\* still treat “Connections” poorly when not mock (\`"—"\`). Should be updated to 2/2 now that Jobber+GHL are live.



\---



\## 5. API routes



\| Route | Purpose |

\|-------|---------|

\| \`GET /api/health\` | Flags snapshot |

\| \`GET /api/health/db\` | Supabase \`sync_connections\` probe |

\| \`GET /api/health/ghl\` | Live \`GET /locations/:id\` (Version \`2021-07-28\`) |

\| \`POST /api/auth/login\` / \`logout\` | iron-session |

\| \`GET /api/oauth/jobber/connect\` | PKCE S256 → Jobber authorize |

\| \`GET /api/oauth/jobber/callback\` | Code exchange, fetch \`account { id name }\`, encrypt tokens, upsert \`sync_connections\` |

\| \`POST /api/webhooks/jobber\` | HMAC SHA256 with Client Secret, persist in-memory inbox, 2xx |

\| \`POST /api/webhooks/ghl\` | Ingest (no signature verification yet) |

\| \`GET /api/admin/audit/capability\` | \`runCapabilityAudit()\` |

\| \`POST /api/internal/process-queue\` | Drain in-memory queue if signing secret matches |



\*\*Middleware public:\*\* \`/login\`, \`/api/webhooks\`, \`/api/health\`, \`/api/auth\`, \`/api/oauth\`. Everything else needs admin session. Missing \`ADMIN_SESSION_SECRET\` in production throws / redirects login.



\---



\## 6. Domain / data



\*\*Supabase\*\* project \`bevweuqllbvpombsqqzu\`. Migration applied: \`supabase/migrations/0001_initial.sql\`



Tables: \`sync_connections\`, \`customer_links\`, \`property_links\`, \`job_links\`, \`appointment_links\`, \`quote_links\`, \`invoice_links\`, \`service_mappings\`, \`sync_events\`, \`queue_jobs\`, \`review_deliveries\`, \`note_deliveries\`, \`sync_conflicts\`, \`sync_configuration\`, \`capability_audit_runs\`, \`integration_audit\`.



OAuth tokens: AES-256-GCM via \`TOKEN_ENCRYPTION_KEY_BASE64\` (32 bytes). Stored in \`sync_connections.encrypted_credentials\` as Postgres \`bytea\` (\`\\\x\` hex).



\*\*Jobber webhooks configured in Developer Center\*\* (same URL \`https\://stmsyncbridge.vercel.app/api/webhooks/jobber\`): JOB_CLOSED/UPDATE/CREATE, VISIT_COMPLETE/UPDATE/CREATE, QUOTE_CREATE/SENT/APPROVED/UPDATE, INVOICE_CREATE/UPDATE, APP_CONNECT/DISCONNECT, PROPERTY_CREATE/UPDATE. \*\*CLIENT_CREATE / CLIENT_UPDATE should be added if missing.\*\*



\*\*Refresh token rotation:\*\* Jobber app setting ON. \*\*App does not yet refresh tokens.\*\* Access tokens \~3600s. Must implement refresh with concurrency lock before relying on ongoing API.



\---



\## 7. Feature flags (default OFF / fail closed)



Env string \`"true"\` only enables. Gates:



\- A: \`OUTBOUND_WRITES_ENABLED\`

\- B: \`HISTORICAL_IMPORT_ENABLED\`

\- C: \`CUSTOMER_MESSAGING_ENABLED\`



Also: \`SYNC_ENABLED\`, \`BOOKING_SYNC_ENABLED\`, \`REVIEW_TRIGGER_ENABLED\`, \`EMERGENCY_AUTO_BOOK_ENABLED\`, etc.



Booking processor uses \`pending_jobber_confirmation\` when writes/scheduling buffers not confirmed (\`src/services/workflows/booking.ts\`).



Queue interface: \`src/lib/queue\` — \*\*memory default in code\*\* even if \`QUEUE_PROVIDER=postgres\` (postgres adapter not fully wired to \`queue_jobs\`).



\---



\## 8. What is NOT done (next work)



Priority agreed with owner:



1\. \*\*Jobber refresh-token rotation\*\* (atomic, lock, persist new tokens). Without this, OAuth dies hourly.

2\. \*\*Live Phase 0 capability audit\*\* using stored Jobber token + GHL PIT: timezone from Jobber, GraphQL operations for client/job/visit/quote/invoice/notes/availability, GHL pipelines/stages/calendars. Write \`docs/API_CAPABILITY_REPORT.md\` + \`docs/ACCOUNT_MAPPING.md\`.

3\. \*\*Persist webhooks\*\* to \`sync_events\` in Supabase; show on Activity.

4\. Service catalog mapping UI (Jobber products → GHL intents).

5\. RLS review on Supabase.

6\. Postgres durable queue.

7\. Phases 2–6 only after P0 sign-off and gates A/B/C.



Do \*\*not\*\* enable auto-booking, reviews, or backfill.



\---



\## 9. Env for Vercel Production (names only)



Required conceptually: \`APP_ENV=production\`, \`APP_BASE_URL=https\://stmsyncbridge.vercel.app\`, Jobber client id/secret/callback/graphql version, \`JOBBER_ALLOWED_ACCOUNT_IDS\` (connected account encoded id), GHL location + PIT + allowlist, Supabase URL + publishable + \*\*service role\*\*, \`ADMIN_SESSION_SECRET\` (≥32 chars), \`TOKEN_ENCRYPTION_KEY_BASE64\`, admin allowlist/password, \`USE_PROVIDER_MOCKS=false\`.



\*\*Never commit \`.env.local\`.\*\* Do not put \`GITHUB_TOKEN\` on Vercel.



Local \`.env.local\` has duplicate \`APP_BASE_URL\` (localhost vs leftover); local should stay \`http\://localhost:3000\`. OAuth callback is \*\*Vercel-only\*\* unless a second Jobber redirect URI is registered.



\---



\## 10. Tests



\`npm test\` — Vitest: T25-style gates, T09/T10 pending booking, audit includes pending path. \`npm run build\` succeeds locally.



\---



\## 11. Coding conventions for the next agent



\- Next.js App Router, server components for dashboard data.

\- Secrets server-side only. Redact errors.

\- Jobber GraphQL: pin \`X-JOBBER-GRAPHQL-VERSION\`; treat \`errors\` / \`userErrors\` as failure even on HTTP 200.

\- EncodedIds are \*\*opaque TEXT\*\*, not integers.

\- Keep feature flags fail-closed.

\- UI: match existing shell tokens; no heavy animation; no client self-service.

\- Ask owner before production writes / messaging / backfill.



When continuing: implement \*\*token refresh + live read-only audit\*\* first. Then persist webhooks. Then stop for P0 report review.
