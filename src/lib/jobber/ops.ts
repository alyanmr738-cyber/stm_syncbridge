import { jobberGraphql } from "@/lib/jobber/graphql";

export type JobberClient = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  emails?: { nodes?: { address?: string }[] };
  phones?: { nodes?: { number?: string }[] };
};

export async function fetchJobberClient(id: string): Promise<JobberClient | null> {
  const data = await jobberGraphql<{ client: JobberClient | null }>(
    `query Client($id: EncodedId!) {
      client(id: $id) {
        id
        firstName
        lastName
        name
        emails { nodes { address } }
        phones { nodes { number } }
      }
    }`,
    { id }
  );
  return data.client;
}

export async function editJobberClient(input: {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): Promise<string> {
  const data = await jobberGraphql<{
    clientEdit: { client: { id: string }; userErrors: { message: string }[] };
  }>(
    `mutation ClientEdit($input: ClientEditInput!) {
      clientEdit(input: $input) {
        client { id }
        userErrors { message }
      }
    }`,
    {
      input: {
        id: input.id,
        firstName: input.firstName,
        lastName: input.lastName,
        emails: input.email ? [{ address: input.email, primary: true }] : undefined,
        phones: input.phone ? [{ number: input.phone, primary: true }] : undefined,
      },
    }
  );
  const err = data.clientEdit.userErrors?.[0];
  if (err) throw new Error(err.message);
  return data.clientEdit.client.id;
}

export async function createJobberClient(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): Promise<string> {
  const data = await jobberGraphql<{
    clientCreate: { client: { id: string }; userErrors: { message: string }[] };
  }>(
    `mutation ClientCreate($input: ClientCreateInput!) {
      clientCreate(input: $input) {
        client { id }
        userErrors { message }
      }
    }`,
    {
      input: {
        firstName: input.firstName,
        lastName: input.lastName,
        emails: input.email ? [{ address: input.email, primary: true }] : undefined,
        phones: input.phone ? [{ number: input.phone, primary: true }] : undefined,
      },
    }
  );
  const err = data.clientCreate.userErrors?.[0];
  if (err) throw new Error(err.message);
  return data.clientCreate.client.id;
}

export async function fetchJobberJob(id: string): Promise<{
  id: string;
  jobStatus?: string;
  client?: { id: string };
} | null> {
  const data = await jobberGraphql<{
    job: { id: string; jobStatus?: string; client?: { id: string } } | null;
  }>(
    `query Job($id: EncodedId!) {
      job(id: $id) { id jobStatus client { id } }
    }`,
    { id }
  );
  return data.job;
}

export async function createJobberNote(opts: {
  clientId?: string;
  jobId?: string;
  message: string;
}): Promise<string | null> {
  if (opts.jobId) {
    const data = await jobberGraphql<{
      jobCreateNote: { jobNote?: { id: string }; userErrors: { message: string }[] };
    }>(
      `mutation Note($input: JobCreateNoteInput!) {
        jobCreateNote(input: $input) { jobNote { id } userErrors { message } }
      }`,
      { input: { jobId: opts.jobId, message: opts.message } }
    );
    return data.jobCreateNote.jobNote?.id ?? null;
  }
  if (opts.clientId) {
    const data = await jobberGraphql<{
      clientCreateNote: { clientNote?: { id: string }; userErrors: { message: string }[] };
    }>(
      `mutation Note($input: ClientCreateNoteInput!) {
        clientCreateNote(input: $input) { clientNote { id } userErrors { message } }
      }`,
      { input: { clientId: opts.clientId, message: opts.message } }
    );
    return data.clientCreateNote.clientNote?.id ?? null;
  }
  return null;
}
