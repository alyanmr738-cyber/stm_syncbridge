# Acceptance matrix — mark PASS only with evidence

| ID | Minimum acceptance test | Evidence | Production permission |
|---|---|---|---|
| A01 | Current SHA/gates and correct Jobber/GHL account IDs | health + verified provider read | Read |
| A02 | Distributed Jobber refresh lock, CAS and concurrent worker single refresh | test logs + persisted generation | No OAuth reconnect |
| A03 | Bounded quarantine retains all 40 incident dead letters | DB counts + authenticated retry 409 | No replay |
| A04 | Future failed event outside bounded window is not quarantined | isolated test/fixture | No artificial prod live event |
| A05 | Valid Jobber webhook HMAC vs invalid signature | tests and route | Read/no writes |
| A06 | Signed GHL webhook accepted and unsigned rejected when required | tests | No real customer edit |
| A07 | Jobber CLIENT_UPDATE on verified existing pair updates same GHL ID | previous Evan proof + regression | Existing approved Gate A/test |
| A08 | GHL field edit on verified existing pair respects Jobber authority without echo loop | staging/pilot proof | Live edit requires test authorization |
| A09 | No-op revision and duplicate hook produce zero extra provider PUTs | assertion on write count | Test |
| A10 | Unknown GHL/Jobber identity never merges or creates | conflict row and zero create calls | Test |
| A11 | Wrong/duplicated phone/email/name leaves unverified | identity fixtures | Test |
| A12 | Deleted Jobber client invalidates link rather than writing | fixture + live-read as needed | Read |
| A13 | Admin can inspect, accept/reject candidate with audit and authorization | UI test / screenshots | Only staging or approved exact records |
| A14 | Batch B candidates remain proposed; no new prod verified links | count + change log | Read |
| A15 | Existing job/opportunity candidate checks account, pipeline, owner and uniqueness | sample fixtures + proposed rows | Read |
| A16 | Unique job link does not duplicate opportunity or link archived record | tests | Prod link write needs approval |
| A17 | Jobber `requires_invoicing` updates existing linked opp to Job Completed | old real pilot + idempotency regression | Approved existing Gate A |
| A18 | Job completion never implies invoice paid | status tests | Test |
| A19 | Disabled invoice/estimate/AI handlers do not fetch Jobber or write GHL | mocked provider call count 0 | Test |
| A20 | Booking lacking verified Jobber appointment stays pending | API/schema proof + fixture | Booking gate OFF |
| A21 | Reschedule/additional visit reuses linked Jobber job; no duplicate | fixture tests | Booking gate OFF |
| A22 | Missing service map and 2-hour policy unknown block auto-confirm | fixture / UI | Booking gate OFF |
| A23 | Historical import dry-run is paginated, resumable and write-free | inventory and write counters 0 | B OFF |
| A24 | Disabled creation cannot call provider create | mocked calls 0 + live flags | Creation OFF |
| A25 | Review ledger ensures once/job + respects consent/historical skip | tests | C OFF |
| A26 | No unwanted GHL native message from existing record PUT | authorized test evidence | Do not publish W4 |
| A27 | Full lint/typecheck/tests/build/browser smoke | logs, failure list | Code deploy only |
| A28 | Rollback steps and production health verified after release | new SHA, environment diff | No gates changed |

**No guessing:** Mark an API capability *not available/proven* if Jobber/GHL cannot demonstrably support it. UI-only behavior does not count as a provider integration PASS.
