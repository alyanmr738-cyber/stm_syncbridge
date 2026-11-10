# Mandatory SyncBridge acceptance tests

Test against mocks/fixtures first, then an explicitly authorized test account or seeded pilot record. Attach test evidence and real provider IDs only in protected internal reports. Never log tokens.

## OAuth/security

- [ ] Initial Jobber OAuth callback authenticates correct Septic Tank Man account and stores encrypted tokens.
- [ ] Forced access-token expiry refreshes and persists *both* rotated tokens.
- [ ] Two concurrent refresh attempts do not redeem a stale refresh token twice.
- [ ] Refresh succeeds after Vercel cold start and multiple instances.
- [ ] Jobber disconnect/reconnect updates health, stops writes, restores safely.
- [ ] Wrong Jobber account and wrong GHL location IDs are rejected.
- [ ] Admin routes require valid session; privileges checked server-side.
- [ ] Login rate limiting, CSRF protections, secure cookies and no public secrets verified.
- [ ] Supabase service key/RLS test confirms no unauthenticated data access.

## Webhooks/durable queue

- [ ] Valid Jobber HMAC accepted; invalid/missing signature rejected.
- [ ] Valid GHL Ed25519 signature accepted; invalid/missing signature rejected for configured webhook delivery mode.
- [ ] Verified event is durably inserted before 2xx acknowledgement.
- [ ] Ingestion meets Jobber <1-second webhook acknowledgement requirement under representative load.
- [ ] Repeated identical webhook results in one processed business effect.
- [ ] Out-of-order updates cannot restore stale contact/job state.
- [ ] Database unavailable -> ingress doesn't falsely acknowledge persistence.
- [ ] Queue survives worker restart, retries transient failures, dead-letters terminal failures.
- [ ] Queue rate limit respects Jobber GraphQL and GHL limits; errors are visible in admin UI.
- [ ] Event origin/fingerprint prevents Jobber ↔ GHL update loop.

## Identity and sync

- [ ] Existing linked customer updates correct record, preserving native IDs.
- [ ] GHL-only customer with no match is created in Jobber when permitted.
- [ ] Multiple matching phone/emails route to conflict review, not automatic merge.
- [ ] Jobber authoritative correction overwrites conflicting GHL customer field without loop.
- [ ] Failed Jobber mutation leaves conflict and transparent retry/reconciliation status.
- [ ] Property/address mapping correct and not silently overwritten by blank data.
- [ ] No arbitrary customer-data writes when gate A OFF.

## Bookings

- [ ] New service booking creates correct Jobber job, links customer and visit, and GHL confirms **only after Jobber confirms actual schedule**.
- [ ] Unavailable slot remains pending and offers only verified available alternatives.
- [ ] Missing service mapping/duration remains pending; no guessed appointment.
- [ ] Reschedule updates existing job/visit, no duplicate job.
- [ ] Extra visit reuses job, creates distinct linked visit when allowed.
- [ ] Repeated/concurrent webhook delivery cannot create duplicate jobs.
- [ ] Jobber schedule changes reflect in matching GHL appointment with no loop.
- [ ] Emergency auto-booking remains disabled regardless of other flags.
- [ ] Lead-time, visit-buffer, travel-buffer and timezone validated without hardcoding a 2-hour assumption.

## Completion, reviews and financial events

- [ ] Jobber job completed moves correct GHL per-job opportunity directly to Completed Job.
- [ ] New opportunity created directly in Completed Job activates dedicated review path when C approved; no dependence solely on stage-changed trigger.
- [ ] Duplicate job completion or reopened/completed job does not send duplicate review.
- [ ] Repeat customer with *different* completed Jobber job can receive one new eligible request.
- [ ] Opt-out/no-consent stops customer messaging; delivery ledger distinguishes attempted/sent/failed.
- [ ] Historical completion event never sends a review.
- [ ] Estimate sent triggers authorized 1-day/7-day/1-month schedule, stops when resolved.
- [ ] Invoice status mirrors actual Jobber status without creating invoice in GHL.
- [ ] AI summary appends once to correct Jobber note with date/source; full transcript remains in GHL.
- [ ] No customer communications when gate C OFF.

## Historical import + UI + release

- [ ] Historical dry-run inventories all accessible records with pagination, counts and checkpoint resume.
- [ ] Interrupted import can resume without duplicates; historical changes suppressed from messages.
- [ ] Import only runs with separate B approval.
- [ ] All dashboard pages show real rows from database and useful empty/error states, no fake 'live' mock metrics.
- [ ] Admin can safely inspect, filter, retry and resolve sync exceptions.
- [ ] Production webhook and OAuth public endpoints reachable; admin pages protected.
- [ ] Unit/integration/browser suite, lint/typecheck/build pass; documented deploy SHA and rollback.
- [ ] Real linked pilot records reconcile with both systems after run; provider event/log evidence attached.
- [ ] A/B/C gates independently enforce runtime restrictions; not just UI toggle labels.
