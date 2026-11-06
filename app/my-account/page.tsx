// app/my-account/page.tsx
"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getOrders,
  login,
  register,
  sendPasswordResetEmail,
  type Order,
  type User,
} from "@/lib/auth";
import { GraphQLError } from "@/lib/graphql";
import {
  validateForgotPasswordForm,
  validateLoginForm,
  validateRegisterForm,
} from "@/lib/validators";
import SubmitButton from "@/components/submit-button";
import FieldError from "@/components/field-error";
import AccountSkeleton from "@/components/account-skeleton";
import { formatKD } from "@/lib/cart";

/* ── Shared styles (design system) ───────────────────────────── */

const INPUT_CLASS =
  "w-full rounded-md border border-[#dee2e6] px-3 py-2 text-sm text-[#212529] placeholder:text-[#6c757d] focus:border-[#e91e63] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-[#212529]";

const ALERT_ERROR_CLASS =
  "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";

const ALERT_SUCCESS_CLASS =
  "rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700";

const LINK_CLASS =
  "text-sm font-medium text-[#e91e63] hover:text-[#c2185b] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded";

/* ── Types ───────────────────────────────────────────────────── */

type AuthTab = "login" | "register" | "forgot";

const AUTH_TABS: ReadonlyArray<{ key: AuthTab; label: string }> = [
  { key: "login", label: "Login" },
  { key: "register", label: "Register" },
  { key: "forgot", label: "Forgot Password" },
];

/* ── Helpers ─────────────────────────────────────────────────── */

/**
 * Only allow same-site relative paths for the "return" parameter.
 * Blocks absolute URLs and protocol-relative URLs such as "//evil.com".
 */
function getSafeReturnPath(raw: string | null): string {
  if (!raw) return "/my-account";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/my-account";
  }
  return raw;
}

/** Shows GraphQL messages as-is (already cleaned), otherwise a fallback. */
function toUserMessage(err: unknown, fallback: string): string {
  return err instanceof GraphQLError ? err.message : fallback;
}

function isAuthTab(value: string | null): value is AuthTab {
  return value === "login" || value === "register" || value === "forgot";
}

/* ── Page (Suspense boundary for useSearchParams) ────────────── */

export default function MyAccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <MyAccountContent />
    </Suspense>
  );
}

function MyAccountContent() {
  const { user, loading } = useAuth();

  // Never show the login form while the session is being checked.
  if (loading) return <AccountSkeleton />;
  if (user) return <Dashboard user={user} />;
  return <AuthForms />;
}

/* ── Dashboard (signed-in users) ─────────────────────────────── */

function Dashboard({ user }: { user: User }) {
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getOrders()
      .then((orders) => {
        if (!cancelled) setRecentOrders(orders.slice(0, 5));
      })
      .catch((err: unknown) => {
        // WooGraphQL may not be installed; show a friendly message instead.
        if (!cancelled) {
          setOrdersError(toUserMessage(err, "Could not load recent orders."));
        }
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const quickLinks = [
    {
      href: "/my-account/orders",
      label: "Orders",
      desc: "View your order history",
    },
    {
      href: "/my-account/addresses",
      label: "Addresses",
      desc: "Edit billing and shipping",
    },
    {
      href: "/my-account/details",
      label: "Account Details",
      desc: "Name, email and password",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-[#212529]">
          Hello{user.firstName ? `, ${user.firstName}` : ""}!
        </h2>
        <p className="mt-1 text-[#6c757d]">
          From your account dashboard you can view recent orders, manage your
          addresses, and edit your account details.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-[#dee2e6] p-5 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
          >
            <h3 className="font-semibold text-[#212529]">{card.label}</h3>
            <p className="mt-1 text-sm text-[#6c757d]">{card.desc}</p>
          </Link>
        ))}
      </div>

      <section aria-labelledby="recent-orders-heading">
        <h3
          id="recent-orders-heading"
          className="mb-3 text-lg font-semibold text-[#212529]"
        >
          Recent Orders
        </h3>

        {ordersLoading ? (
          <p className="text-sm text-[#6c757d]">Loading orders…</p>
        ) : ordersError ? (
          <p role="alert" className={ALERT_ERROR_CLASS}>
            {ordersError}
          </p>
        ) : recentOrders.length === 0 ? (
          <p className="text-sm text-[#6c757d]">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#dee2e6]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/my-account/orders/${order.databaseId}`}
                        className={LINK_CLASS}
                      >
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#6c757d]">
                      {new Date(order.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-[#212529]">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#212529]">
                      {formatKD(Number(order.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Guest view: Login / Register / Forgot password ──────────── */

function AuthForms() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<AuthTab>(
    isAuthTab(requestedTab) ? requestedTab : "login",
  );

  return (
    <div className="mx-auto max-w-md">
      <div
        className="mb-6 flex border-b border-[#dee2e6]"
        role="tablist"
        aria-label="Account access"
      >
        {AUTH_TABS.map(({ key, label }) => {
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`auth-tab-${key}`}
              aria-selected={selected}
              aria-controls={`auth-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(key)}
              className={`flex-1 border-b-2 px-3 py-3 text-[14px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e91e63] ${
                selected
                  ? "border-[#e91e63] text-[#e91e63]"
                  : "border-transparent text-[#6c757d] hover:text-[#212529]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`auth-panel-${tab}`}
        aria-labelledby={`auth-tab-${tab}`}
      >
        {tab === "login" && <LoginForm />}
        {tab === "register" && <RegisterForm />}
        {tab === "forgot" && <ForgotPasswordForm />}
      </div>
    </div>
  );
}

/* ── Login ───────────────────────────────────────────────────── */

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateLoginForm({ username, password });
    setErrors(validation.errors);
    if (!validation.valid) return;

    setFormError("");
    setLoading(true);
    try {
      await login(username, password);
      // AUTH_EVENT fires inside login(), so the header updates immediately.
      router.replace(getSafeReturnPath(searchParams.get("return")));
    } catch (err: unknown) {
      setFormError(toUserMessage(err, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className={ALERT_ERROR_CLASS}>
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="login-username" className={LABEL_CLASS}>
          Username or email
        </label>
        <input
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          aria-invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? "login-username-error" : undefined}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={INPUT_CLASS}
        />
        <FieldError message={errors.username} id="login-username-error" />
      </div>

      <div>
        <label htmlFor="login-password" className={LABEL_CLASS}>
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "login-password-error" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
        />
        <FieldError message={errors.password} id="login-password-error" />
      </div>

      <SubmitButton loading={loading} label="Log In" loadingLabel="Logging in…" />
    </form>
  );
}

/* ── Register ────────────────────────────────────────────────── */

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateRegisterForm({ username, email, password });
    setErrors(validation.errors);
    if (!validation.valid) return;

    setFormError("");
    setLoading(true);
    try {
      await register(username, email, password);
      router.replace(getSafeReturnPath(searchParams.get("return")));
    } catch (err: unknown) {
      setFormError(toUserMessage(err, "Registration failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className={ALERT_ERROR_CLASS}>
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="reg-username" className={LABEL_CLASS}>
          Username
        </label>
        <input
          id="reg-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          aria-invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? "reg-username-error" : undefined}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={INPUT_CLASS}
        />
        <FieldError message={errors.username} id="reg-username-error" />
      </div>

      <div>
        <label htmlFor="reg-email" className={LABEL_CLASS}>
          Email
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "reg-email-error" : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASS}
        />
        <FieldError message={errors.email} id="reg-email-error" />
      </div>

      <div>
        <label htmlFor="reg-password" className={LABEL_CLASS}>
          Password
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "reg-password-error reg-password-hint" : "reg-password-hint"
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
        />
        <p id="reg-password-hint" className="mt-1 text-xs text-[#6c757d]">
          Minimum 8 characters.
        </p>
        <FieldError message={errors.password} id="reg-password-error" />
      </div>

      <SubmitButton
        loading={loading}
        label="Register"
        loadingLabel="Creating account…"
      />
    </form>
  );
}

/* ── Forgot password ─────────────────────────────────────────── */

function ForgotPasswordForm() {
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateForgotPasswordForm({ username });
    setErrors(validation.errors);
    if (!validation.valid) return;

    setLoading(true);
    // sendPasswordResetEmail never reveals whether the account exists,
    // so the same confirmation is shown in every case.
    await sendPasswordResetEmail(username);
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <p role="status" className={ALERT_SUCCESS_CLASS}>
        If an account with that username or email exists, a password reset link
        has been sent.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="text-sm text-[#6c757d]">
        Enter your username or email and we will send you a reset link.
      </p>

      <div>
        <label htmlFor="forgot-username" className={LABEL_CLASS}>
          Username or email
        </label>
        <input
          id="forgot-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          aria-invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? "forgot-username-error" : undefined}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={INPUT_CLASS}
        />
        <FieldError message={errors.username} id="forgot-username-error" />
      </div>

      <SubmitButton
        loading={loading}
        label="Send Reset Link"
        loadingLabel="Sending…"
      />
    </form>
  );
}
