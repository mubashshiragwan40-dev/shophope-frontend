// app/my-account/details/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import AuthGuard from "@/components/auth-guard";
import AccountSkeleton from "@/components/account-skeleton";
import SubmitButton from "@/components/submit-button";
import FieldError from "@/components/field-error";
import { useAuth } from "@/hooks/use-auth";
import { updateUser, sendPasswordResetEmail, type User } from "@/lib/auth";
import { GraphQLError } from "@/lib/graphql";
import { validateDetailsForm } from "@/lib/validators";

/* ── Shared styles (design system) ───────────────────────────── */

const INPUT_CLASS =
  "w-full rounded-md border border-[#dee2e6] px-3 py-2 text-sm text-[#212529] placeholder:text-[#6c757d] focus:border-[#e91e63] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-[#212529]";

const ALERT_ERROR_CLASS =
  "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";

const ALERT_SUCCESS_CLASS =
  "rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700";

/* ── Page ────────────────────────────────────────────────────── */

export default function DetailsPage() {
  return (
    <AuthGuard>
      <DetailsContent />
    </AuthGuard>
  );
}

function DetailsContent() {
  const { user, loading } = useAuth();
  if (loading) return <AccountSkeleton />;
  if (!user) return null;

  return (
    <div className="space-y-10">
      <h2 className="text-xl font-semibold text-[#212529]">Account Details</h2>
      <ProfileForm user={user} />
      <ChangePasswordSection username={user.username} />
    </div>
  );
}

/* ── Profile form ────────────────────────────────────────────── */

function ProfileForm({ user }: { user: User }) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateDetailsForm({ firstName, lastName, email });
    setErrors(validation.errors);
    if (!validation.valid) return;

    setFormError("");
    setSuccess("");
    setLoading(true);

    try {
      await updateUser({
        id: user.id,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim(),
      });
      setSuccess("Account details saved.");
    } catch (err: unknown) {
      setFormError(
        err instanceof GraphQLError ? err.message : "Failed to save details.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-4">
      {formError && (
        <div role="alert" className={ALERT_ERROR_CLASS}>
          {formError}
        </div>
      )}
      {success && (
        <div role="status" className={ALERT_SUCCESS_CLASS}>
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="details-first-name" className={LABEL_CLASS}>
            First name
          </label>
          <input
            id="details-first-name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="details-last-name" className={LABEL_CLASS}>
            Last name
          </label>
          <input
            id="details-last-name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <label htmlFor="details-email" className={LABEL_CLASS}>
          Email
        </label>
        <input
          id="details-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "details-email-error" : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASS}
        />
        <FieldError message={errors.email} id="details-email-error" />
      </div>

      <SubmitButton
        loading={loading}
        label="Save Changes"
        loadingLabel="Saving…"
      />
    </form>
  );
}

/* ── Change password (via reset email) ───────────────────────── */

function ChangePasswordSection({ username }: { username: string }) {
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setLoading(true);

    // The core WPGraphQL updateUser mutation does not expose a password
    // field, so a reset link is sent instead. sendPasswordResetEmail
    // returns false on failure instead of throwing.
    const sent = await sendPasswordResetEmail(username);

    if (sent) {
      setSuccess(
        "A password reset link has been sent to your email. Follow it to set a new password.",
      );
    } else {
      setFormError("Could not send the reset link. Please try again.");
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="max-w-lg space-y-4 rounded-lg border border-[#dee2e6] p-5"
    >
      <h3 className="text-sm font-semibold uppercase text-[#6c757d]">
        Change Password
      </h3>

      <p className="text-sm text-[#6c757d]">
        For security, password changes are handled through a reset link sent to
        your email.
      </p>

      {formError && (
        <div role="alert" className={ALERT_ERROR_CLASS}>
          {formError}
        </div>
      )}
      {success && (
        <div role="status" className={ALERT_SUCCESS_CLASS}>
          {success}
        </div>
      )}

      <SubmitButton
        loading={loading}
        label="Send Reset Link"
        loadingLabel="Sending…"
      />
    </form>
  );
}
