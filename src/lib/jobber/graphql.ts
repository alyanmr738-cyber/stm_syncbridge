import { getEnv } from "@/lib/config/env";
import { getValidJobberAccessToken, markJobberDisconnected } from "@/lib/jobber/tokens";

const ENDPOINT = "https://api.getjobber.com/api/graphql";

export type GraphqlResult<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function jobberGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const env = getEnv();
  const version = env.JOBBER_GRAPHQL_VERSION;
  if (!version) {
    throw new Error("JOBBER_GRAPHQL_VERSION is not pinned");
  }
  const { accessToken } = await getValidJobberAccessToken();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": version,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) {
    await markJobberDisconnected("http_401");
    throw new Error("Jobber unauthorized — reconnect required");
  }
  const json = (await res.json()) as GraphqlResult<T> & {
    data?: T & { userErrors?: { message: string }[] };
  };
  if (json.errors?.length) {
    throw new Error(`Jobber GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Jobber GraphQL empty data");
  return json.data;
}

export async function jobberIntrospectType(name: string): Promise<string[]> {
  const data = await jobberGraphql<{
    __type: {
      fields?: { name: string }[];
      inputFields?: { name: string }[];
    } | null;
  }>(
    `query TypeFields($name: String!) {
      __type(name: $name) { name fields { name } inputFields { name } }
    }`,
    { name }
  );
  const t = data.__type;
  if (!t) return [];
  return [
    ...(t.fields ?? []).map((f) => f.name),
    ...(t.inputFields ?? []).map((f) => f.name),
  ];
}

export async function jobberMutationNames(): Promise<string[]> {
  const data = await jobberGraphql<{
    __schema: { mutationType: { fields: { name: string }[] } | null };
  }>(`query { __schema { mutationType { fields { name } } } }`);
  return data.__schema.mutationType?.fields.map((f) => f.name) ?? [];
}

export async function jobberQueryNames(): Promise<string[]> {
  const data = await jobberGraphql<{
    __schema: { queryType: { fields: { name: string }[] } | null };
  }>(`query { __schema { queryType { fields { name } } } }`);
  return data.__schema.queryType?.fields.map((f) => f.name) ?? [];
}
