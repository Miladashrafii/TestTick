import { createYoga } from "graphql-yoga";
import { resolveApiActor } from "@/lib/api/actor";
import { schema, type GraphQLContext } from "@/lib/graphql/schema";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  // Next.js provides the WHATWG Response implementation used to build the reply.
  fetchAPI: { Response },
  context: async ({ request }): Promise<GraphQLContext> => ({
    actor: await resolveApiActor(request),
  }),
});

async function handler(request: Request): Promise<Response> {
  return yoga.handleRequest(request, {});
}

export { handler as GET, handler as POST, handler as OPTIONS };
