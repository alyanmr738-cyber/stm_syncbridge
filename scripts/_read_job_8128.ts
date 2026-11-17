import { fetchJobberJob } from "../src/lib/jobber/ops";
import { jobClosed } from "../src/lib/sync/matching";
import { jobberGraphql } from "../src/lib/jobber/graphql";

const JOB = "Z2lkOi8vSm9iYmVyL0pvYi8xNjI3MTYxMTE=";

async function main() {
  const job = await fetchJobberJob(JOB);
  console.log(JSON.stringify({ job, jobClosed: jobClosed(job?.jobStatus) }, null, 2));
  const introspect = await jobberGraphql<{
    __type: { fields?: { name: string }[] } | null;
  }>(`{ __type(name: "Query") { fields { name } } }`);
  const names = (introspect.__type?.fields ?? []).map((f) => f.name);
  console.log("query webhook-like", names.filter((n) => /hook|webhook/i.test(n)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
