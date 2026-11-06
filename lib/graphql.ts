// lib/graphql.ts
// ------------------------------------------------------------------
// Thin fetch wrapper for WPGraphQL. Handles auth headers and strips
// HTML from WordPress error messages. Used by lib/auth.ts and any
// page that needs to call the API directly.
// ------------------------------------------------------------------

export class GraphQLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphQLError";
  }
}

export class ExpiredTokenError extends GraphQLError {
  constructor(message: string) {
    super(message);
    this.name = "ExpiredTokenError";
  }
}

/** Remove HTML tags from WordPress error messages. */
function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }
  return html.replace(/<[^>]*>/g, "");
}

export interface GraphQLResponse<T> {
  data: T | null;
  errors?: { message: string }[];
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(process.env.NEXT_PUBLIC_WORDPRESS_API_URL!, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors?.length) {
    const msg = stripHtml(json.errors[0].message);

    // Detect expired / invalid JWT so callers can refresh
    if (
      /expired|jwt.*invalid|invalid.*token|jwt.*expired/i.test(msg)
    ) {
      throw new ExpiredTokenError(msg);
    }
    throw new GraphQLError(msg);
  }

  if (!json.data) {
    throw new GraphQLError("No data returned from the server.");
  }

  return json.data;
}
