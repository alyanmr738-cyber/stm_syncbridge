import { jobberGraphql } from "@/lib/jobber/graphql";

export type JobberProperty = {
  id: string;
  address?: { street1?: string; city?: string; postalCode?: string } | null;
};

export type JobberClient = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  emails?: { id?: string; address?: string }[];
  phones?: { id?: string; number?: string }[];
  clientProperties?: { nodes?: JobberProperty[] };
};

export function isJobberEncodedId(id?: string | null): id is string {
  return Boolean(id && id.startsWith("Z2lkOi8v"));
}

export async function fetchJobberClient(id: string): Promise<JobberClient | null> {
  if (!isJobberEncodedId(id)) return null;
  const data = await jobberGraphql<{ client: JobberClient | null }>(
    `query Client($id: EncodedId!) {
      client(id: $id) {
        id
        firstName
        lastName
        name
        emails { id address }
        phones { id number }
        clientProperties(first: 10) {
          nodes { id address { street1 city postalCode } }
        }
      }
    }`,
    { id }
  );
  return data.client;
}

export async function searchJobberClients(searchTerm: string): Promise<JobberClient[]> {
  const q = searchTerm.trim();
  if (q.length < 3) return [];
  const data = await jobberGraphql<{ clients: { nodes: JobberClient[] } }>(
    `query Search($q: String!) {
      clients(searchTerm: $q, first: 10) {
        nodes {
          id name firstName lastName
          emails { address }
          phones { number }
        }
      }
    }`,
    { q }
  );
  return data.clients.nodes ?? [];
}

export function buildClientEditVariables(input: {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  existing?: JobberClient | null;
}): { clientId: string; input: Record<string, unknown> } {
  const body: Record<string, unknown> = {};
  if (input.firstName) body.firstName = input.firstName;
  if (input.lastName) body.lastName = input.lastName;
  const haveEmail = (input.existing?.emails ?? []).some(
    (e) => e.address?.toLowerCase() === input.email?.toLowerCase()
  );
  const havePhone = (input.existing?.phones ?? []).some((p) =>
    (p.number ?? "").replace(/\D/g, "").endsWith((input.phone ?? "").replace(/\D/g, "").slice(-10))
  );
  if (input.email && !haveEmail) {
    body.emailsToAdd = [{ address: input.email, primary: true }];
  }
  if (input.phone && !havePhone) {
    body.phonesToAdd = [{ number: input.phone, primary: true }];
  }
  return { clientId: input.id, input: body };
}

export async function editJobberClient(input: {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): Promise<string> {
  const existing = await fetchJobberClient(input.id);
  const variables = buildClientEditVariables({ ...input, existing });
  const data = await jobberGraphql<{
    clientEdit: { client: { id: string }; userErrors: { message: string }[] };
  }>(
    `mutation ClientEdit($clientId: EncodedId!, $input: ClientEditInput!) {
      clientEdit(clientId: $clientId, input: $input) {
        client { id }
        userErrors { message }
      }
    }`,
    variables
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
  title?: string;
  jobNumber?: string;
  client?: { id: string };
} | null> {
  if (!isJobberEncodedId(id)) return null;
  const data = await jobberGraphql<{
    job: {
      id: string;
      jobStatus?: string;
      title?: string;
      jobNumber?: string;
      client?: { id: string };
    } | null;
  }>(
    `query Job($id: EncodedId!) {
      job(id: $id) { id jobStatus title jobNumber client { id } }
    }`,
    { id }
  );
  return data.job;
}

export async function fetchJobberQuote(id: string): Promise<{
  id: string;
  quoteNumber?: string;
  quoteStatus?: string;
  client?: { id: string };
} | null> {
  if (!isJobberEncodedId(id)) return null;
  const data = await jobberGraphql<{
    quote: {
      id: string;
      quoteNumber?: string;
      quoteStatus?: string;
      client?: { id: string };
    } | null;
  }>(
    `query Quote($id: EncodedId!) {
      quote(id: $id) { id quoteNumber quoteStatus client { id } }
    }`,
    { id }
  );
  return data.quote;
}

export async function fetchJobberInvoice(id: string): Promise<{
  id: string;
  invoiceNumber?: string;
  invoiceStatus?: string;
  client?: { id: string };
} | null> {
  if (!isJobberEncodedId(id)) return null;
  const data = await jobberGraphql<{
    invoice: {
      id: string;
      invoiceNumber?: string;
      invoiceStatus?: string;
      client?: { id: string };
    } | null;
  }>(
    `query Invoice($id: EncodedId!) {
      invoice(id: $id) { id invoiceNumber invoiceStatus client { id } }
    }`,
    { id }
  );
  return data.invoice;
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
      `mutation Note($jobId: EncodedId!, $input: JobCreateNoteInput!) {
        jobCreateNote(jobId: $jobId, input: $input) {
          jobNote { id }
          userErrors { message }
        }
      }`,
      { jobId: opts.jobId, input: { message: opts.message } }
    );
    return data.jobCreateNote.jobNote?.id ?? null;
  }
  if (opts.clientId) {
    const data = await jobberGraphql<{
      clientCreateNote: { clientNote?: { id: string }; userErrors: { message: string }[] };
    }>(
      `mutation Note($clientId: EncodedId!, $input: ClientCreateNoteInput!) {
        clientCreateNote(clientId: $clientId, input: $input) {
          clientNote { id }
          userErrors { message }
        }
      }`,
      { clientId: opts.clientId, input: { message: opts.message } }
    );
    return data.clientCreateNote.clientNote?.id ?? null;
  }
  return null;
}
