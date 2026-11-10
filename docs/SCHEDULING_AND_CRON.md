# Queue scheduling decision

**Vercel Hobby** allows cron **once per day**. `* * * * *` does not run automatically on Hobby (deploy may succeed while the schedule is ignored or rejected).

**Chosen production approach (this commit):**

1. **Primary:** drain the postgres queue in `after()` on every authenticated Jobber/GHL webhook (up to 10 jobs). Events process without waiting for cron.
2. **Sweep:** Vercel Cron `0 14 * * *` (14:00 UTC daily) GET `/api/internal/process-queue` with `CRON_SECRET` to reclaim expired leases and leftovers.
3. **Manual/ops:** same GET with bearer, or Activity retry.

Upgrade to **Vercel Pro** if you need native every-minute cron. Until then, do not treat minute cron as proven.

Booking: Jobber has `visitCreate`, `visitEditSchedule`, `scheduledItems`. There is **no** availability/reservation query. **Keep `pending_jobber_confirmation`.** Emergency auto-book remains off.
