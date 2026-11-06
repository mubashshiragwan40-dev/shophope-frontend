// lib/auth.ts
// ------------------------------------------------------------------
// Authentication, session management, and account queries for the
// My Account pages. Every exported action throws a GraphQLError whose
// message is short and safe to show to the user. Tokens and personal
// data are never logged.
// ------------------------------------------------------------------

import { graphqlRequest, ExpiredTokenError, GraphQLError } from "./graphql";

/* ── Constants ───────────────────────────────────────────────── */

const AUTH_TOKEN_KEY = "wp_auth_token";
const REFRESH_TOKEN_KEY = "wp_refresh_token";
export const AUTH_EVENT = "auth-state-change";

const MSG_NETWORK =
  "We could not reach the store. Check your connection and try again.";
const MSG_NOT_SIGNED_IN = "Please log in to continue.";
const MSG_SESSION_EXPIRED = "Your session has expired. Please log in again.";
const MSG_LINK_INVALID =
  "This reset link is invalid or has expired. Please request a new one.";
const MSG_RESET_FAILED = "Could not reset your password. Please try again.";

/* ── Tokens ──────────────────────────────────────────────────── */

export interface AuthTokens {
  authToken: string;
  refreshToken: string;
}

export function getTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  return authToken && refreshToken ? { authToken, refreshToken } : null;
}

/** Returns the stored auth token, or null. Safe to call during SSR. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(AUTH_TOKEN_KEY, tokens.authToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function dispatchAuthEvent(): void {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/* ── Types ───────────────────────────────────────────────────── */

export interface User {
  id: string;
  databaseId: number;
  username: string;
  name: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface Address {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface Customer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  billing?: Address | null;
  shipping?: Address | null;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  billing?: Address;
  shipping?: Address;
}

export interface UpdateUserInput {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface Order {
  id: string;
  databaseId: number;
  orderNumber: string;
  date: string;
  status: string;
  /** Raw amount as a string, e.g. "12.500". Convert with Number() before formatKD. */
  total: string;
  currency?: string;
}

export interface OrderDetail extends Order {
  paymentMethodTitle?: string | null;
  lineItems?: {
    nodes: {
      product?: { name: string; id: string } | null;
      quantity: number;
      total: string;
    }[];
  };
  shipping?: {
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
  } | null;
  billing?: {
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

/* ── Error mapping ───────────────────────────────────────────── */

interface MessageRule {
  pattern: RegExp;
  message: string;
}

/** Turns known WordPress messages into friendly text. */
const MESSAGE_RULES: ReadonlyArray<MessageRule> = [
  {
    pattern:
      /email.*(already|exists|registered|in use)|(already|exists|registered|in use).*email/i,
    message: "That email address is already registered.",
  },
  {
    pattern:
      /username.*(already|exists|in use|taken)|(already|exists|in use).*username/i,
    message: "That username is already taken.",
  },
  {
    pattern:
      /incorrect|invalid username|invalid email|unknown email|does not exist/i,
    message: "Incorrect username or password.",
  },
];

const MAX_RAW_MESSAGE_LENGTH = 160;

/**
 * Maps any thrown value to a short, user-facing message.
 * Known WordPress messages are rewritten; other GraphQL messages are shown
 * if they are short, and the fallback is used otherwise.
 */
export function toFriendlyMessage(err: unknown, fallback: string): string {
  if (err instanceof ExpiredTokenError) return MSG_SESSION_EXPIRED;
  if (!(err instanceof GraphQLError)) return fallback;

  for (const rule of MESSAGE_RULES) {
    if (rule.pattern.test(err.message)) return rule.message;
  }
  const raw = err.message.trim();
  return raw && raw.length <= MAX_RAW_MESSAGE_LENGTH ? raw : fallback;
}

/** Sends a request and converts network and parsing failures to GraphQLError. */
async function request<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  try {
    return await graphqlRequest<T>(query, variables, token);
  } catch (err: unknown) {
    if (err instanceof GraphQLError) throw err;
    // fetch failed (offline, CORS, DNS), or the response was not JSON.
    throw new GraphQLError(MSG_NETWORK);
  }
}

/** Runs an action and rethrows any error with a friendly message. */
async function friendly<T>(
  fallback: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (err: unknown) {
    throw new GraphQLError(toFriendlyMessage(err, fallback));
  }
}

/* ── Session refresh ─────────────────────────────────────────── */

const REFRESH_MUTATION = /* GraphQL */ `
  mutation RefreshJwtAuthToken($input: RefreshJwtAuthTokenInput!) {
    refreshJwtAuthToken(input: $input) {
      authToken
    }
  }
`;

/**
 * Exchanges the stored refresh token for a new auth token.
 * Returns true when the new token is saved, false otherwise.
 */
export async function refreshSession(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;

  try {
    const data = await request<{
      refreshJwtAuthToken: { authToken: string } | null;
    }>(REFRESH_MUTATION, { input: { jwtRefreshToken: tokens.refreshToken } });

    const newAuthToken = data.refreshJwtAuthToken?.authToken;
    if (!newAuthToken) return false;

    setTokens({ authToken: newAuthToken, refreshToken: tokens.refreshToken });
    dispatchAuthEvent();
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs a query or mutation as the signed-in user. If the auth token has
 * expired, refreshes it once and retries once. Logs out if that fails.
 */
async function authedRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const tokens = getTokens();
  if (!tokens) throw new GraphQLError(MSG_NOT_SIGNED_IN);

  try {
    return await request<T>(query, variables, tokens.authToken);
  } catch (err: unknown) {
    if (!(err instanceof ExpiredTokenError)) throw err;
  }

  const refreshed = await refreshSession();
  const fresh = refreshed ? getTokens() : null;
  if (!fresh) {
    await logout();
    throw new GraphQLError(MSG_SESSION_EXPIRED);
  }

  try {
    return await request<T>(query, variables, fresh.authToken);
  } catch (err: unknown) {
    if (err instanceof ExpiredTokenError) {
      await logout();
      throw new GraphQLError(MSG_SESSION_EXPIRED);
    }
    throw err;
  }
}

/* ── Login, register, logout ─────────────────────────────────── */

const LOGIN_MUTATION = /* GraphQL */ `
  mutation LoginUser($input: LoginInput!) {
    login(input: $input) {
      authToken
      refreshToken
      user {
        id
        databaseId
        username
        name
        email
        firstName
        lastName
      }
    }
  }
`;

export function login(username: string, password: string): Promise<User> {
  return friendly("Login failed. Please try again.", async () => {
    const data = await request<{
      login: { authToken: string; refreshToken: string; user: User };
    }>(LOGIN_MUTATION, { input: { username, password } });

    setTokens({
      authToken: data.login.authToken,
      refreshToken: data.login.refreshToken,
    });
    dispatchAuthEvent();
    return data.login.user;
  });
}

const REGISTER_MUTATION = /* GraphQL */ `
  mutation RegisterUser($input: RegisterUserInput!) {
    registerUser(input: $input) {
      user {
        id
        databaseId
        username
      }
    }
  }
`;

/**
 * Creates the account, then signs the user in with the new credentials.
 * The core registerUser mutation does not return tokens, so login() is
 * called afterwards.
 */
export function register(
  username: string,
  email: string,
  password: string,
): Promise<User> {
  return friendly("Registration failed. Please try again.", async () => {
    await request(REGISTER_MUTATION, { input: { username, email, password } });
    return login(username, password);
  });
}

export async function logout(): Promise<void> {
  clearTokens();
  dispatchAuthEvent();
}

/* ── Viewer ──────────────────────────────────────────────────── */

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      id
      databaseId
      username
      name
      email
      firstName
      lastName
    }
  }
`;

/** Returns the signed-in user, or throws if the session is invalid. */
export function getViewer(): Promise<User> {
  return friendly("Could not load your account.", async () => {
    const data = await authedRequest<{ viewer: User | null }>(VIEWER_QUERY);
    if (!data.viewer) throw new GraphQLError(MSG_SESSION_EXPIRED);
    return data.viewer;
  });
}

/* ── Password reset (core WPGraphQL mutations) ───────────────── */

const SEND_RESET_MUTATION = /* GraphQL */ `
  mutation SendPasswordResetEmail($input: SendPasswordResetEmailInput!) {
    sendPasswordResetEmail(input: $input) {
      user {
        id
      }
    }
  }
`;

/**
 * Requests a reset email. Returns false on any failure, so callers can show
 * the same confirmation whether or not the account exists.
 */
export async function sendPasswordResetEmail(username: string): Promise<boolean> {
  try {
    await request(SEND_RESET_MUTATION, { input: { username } });
    return true;
  } catch {
    return false;
  }
}

const RESET_PASSWORD_MUTATION = /* GraphQL */ `
  mutation ResetUserPassword($input: ResetUserPasswordInput!) {
    resetUserPassword(input: $input) {
      user {
        id
      }
    }
  }
`;

export async function resetUserPassword(
  key: string,
  login: string,
  password: string,
): Promise<void> {
  try {
    await request(RESET_PASSWORD_MUTATION, { input: { key, login, password } });
  } catch (err: unknown) {
    // An expired key surfaces as an expiry error, so show the link message.
    if (err instanceof ExpiredTokenError) {
      throw new GraphQLError(MSG_LINK_INVALID);
    }
    throw new GraphQLError(toFriendlyMessage(err, MSG_RESET_FAILED));
  }
}

/* ── Profile (core WPGraphQL updateUser) ─────────────────────── */

const UPDATE_USER_MUTATION = /* GraphQL */ `
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      user {
        id
        databaseId
        username
        name
        email
        firstName
        lastName
      }
    }
  }
`;

export function updateUser(input: UpdateUserInput): Promise<User> {
  return friendly("Could not save your details. Please try again.", async () => {
    const data = await authedRequest<{ updateUser: { user: User } }>(
      UPDATE_USER_MUTATION,
      { input },
    );
    return data.updateUser.user;
  });
}

/* ── Customer (WooGraphQL) ───────────────────────────────────── */

const CUSTOMER_FIELDS = /* GraphQL */ `
  id
  firstName
  lastName
  email
  billing {
    firstName
    lastName
    company
    address1
    address2
    city
    state
    postcode
    country
    phone
    email
  }
  shipping {
    firstName
    lastName
    company
    address1
    address2
    city
    state
    postcode
    country
  }
`;

const CUSTOMER_QUERY = /* GraphQL */ `
  query Customer {
    customer {
      ${CUSTOMER_FIELDS}
    }
  }
`;

const UPDATE_CUSTOMER_MUTATION = /* GraphQL */ `
  mutation UpdateCustomer($input: UpdateCustomerInput!) {
    updateCustomer(input: $input) {
      customer {
        ${CUSTOMER_FIELDS}
      }
    }
  }
`;

export function getCustomer(): Promise<Customer> {
  return friendly("Could not load your addresses.", async () => {
    const data = await authedRequest<{ customer: Customer | null }>(
      CUSTOMER_QUERY,
    );
    if (!data.customer) {
      throw new GraphQLError("Customer data is not available for this account.");
    }
    return data.customer;
  });
}

export function updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
  return friendly("Could not save your address. Please try again.", async () => {
    const data = await authedRequest<{ updateCustomer: { customer: Customer } }>(
      UPDATE_CUSTOMER_MUTATION,
      { input },
    );
    return data.updateCustomer.customer;
  });
}

/* ── Orders (WooGraphQL, scoped to the signed-in user) ───────── */

const ORDERS_QUERY = /* GraphQL */ `
  query Orders {
    orders {
      nodes {
        id
        databaseId
        orderNumber
        date
        status
        total(format: RAW)
      }
    }
  }
`;

const ORDER_QUERY = /* GraphQL */ `
  query Order($id: ID!) {
    order(id: $id, idType: DATABASE_ID) {
      id
      databaseId
      orderNumber
      date
      status
      total(format: RAW)
      paymentMethodTitle
      lineItems {
        nodes {
          product {
            id
            name
          }
          quantity
          total(format: RAW)
        }
      }
      shipping {
        address1
        address2
        city
        state
        postcode
        country
      }
      billing {
        address1
        address2
        city
        state
        postcode
        country
        email
        phone
      }
    }
  }
`;

export function getOrders(): Promise<Order[]> {
  return friendly("Could not load your orders.", async () => {
    const data = await authedRequest<{ orders: { nodes: Order[] } | null }>(
      ORDERS_QUERY,
    );
    return data.orders?.nodes ?? [];
  });
}

export function getOrder(id: string): Promise<OrderDetail> {
  return friendly("Could not load this order.", async () => {
    const data = await authedRequest<{ order: OrderDetail | null }>(
      ORDER_QUERY,
      { id },
    );
    // Returns null for orders that do not belong to the signed-in user.
    if (!data.order) throw new GraphQLError("Order not found.");
    return data.order;
  });
}
