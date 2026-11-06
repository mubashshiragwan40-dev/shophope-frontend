// app/my-account/reset-password/page.tsx
"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SubmitButton from "@/components/submit-button";
import FieldError from "@/components/field-error";
import { resetUserPassword } from "@/lib/auth";
import { GraphQLError } from "@/lib/graphql";
import { validateResetPasswordForm } from "@/lib/validators";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md animate-pulse space-y-4 py-8">
          <div className="h-6 w-2/3 rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const login = searchParams.get("login");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Invalid or missing params
  if (!key || !login) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Invalid reset link. Please request a new password reset.
        </div>
        <Link
          href="/my-account"
          className="mt-4 inline-block text-sm font-medium text-[#e91e63] hover:underline"
        >
          &larr; Back to My Account
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validation = validateResetPasswordForm({ password, confirmPassword });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setFormError("");
    setLoading(true);

    try {
      await resetUserPassword(key!, login!, password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof GraphQLError) setFormError(err.message);
      else setFormError("Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <div
          role="alert"
          className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          Your password has been reset successfully.
        </div>
        <Link
          href="/my-account"
          className="mt-4 inline-block text-sm font-medium text-[#e91e63] hover:underline"
        >
          Log in with your new password
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <h2 className="mb-2 text-xl font-semibold text-[#212529]">
        Set New Password
      </h2>
      <p className="mb-6 text-sm text-[#6c757d]">
        Enter a new password for your account.
      </p>

      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="reset-password"
            className="mb-1 block text-sm font-medium text-[#212529]"
          >
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-[#dee2e6] px-3 py-2 text-sm text-[#212529] focus:border-[#e91e63] focus:outline-none focus:ring-1 focus:ring-[#e91e63]"
          />
          <FieldError message={errors.password} id="reset-password-error" />
          <p className="mt-1 text-xs text-[#6c757d]">Minimum 8 characters.</p>
        </div>

        <div>
          <label
            htmlFor="reset-confirm-password"
            className="mb-1 block text-sm font-medium text-[#212529]"
          >
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-[#dee2e6] px-3 py-2 text-sm text-[#212529] focus:border-[#e91e63] focus:outline-none focus:ring-1 focus:ring-[#e91e63]"
          />
          <FieldError
            message={errors.confirmPassword}
            id="reset-confirm-password-error"
          />
        </div>

        <SubmitButton loading={loading} label="Reset Password" />
      </form>
    </div>
  );
}
