# Queue scheduling decision

**Vercel Pro** (including Pro trial) allows cron **once per minute**. Hobby is limited to once per day.

**Production approach:**

1. **Fast path:** drain the postgres queue in `after()` on every authenticated Jobber/GHL webhook (up to 10 jobs).
2. **Automatic sweep:** Vercel Cron `* * * * *` GET `/api/internal/process-queue` with `CRON_SECRET` to reclaim expired leases and leftovers.
3. **Manual/ops:** same GET with bearer, or Activity retry.

Confirm in Vercel → Project → Cron Jobs that the minute schedule is listed on the **production** deployment. Cron runs only on production.

If the trial ends and the project drops to Hobby, change the expression back to a daily schedule or the deploy will fail.

Booking: Jobber has `visitCreate`, `visitEditSchedule`, `scheduledItems`. There is **no** availability/reservation query. **Keep `pending_jobber_confirmation`.** Emergency auto-book remains off.
