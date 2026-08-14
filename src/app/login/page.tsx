"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { loginSchema } from "@/lib/validation/schemas";

export default function LoginPage() {
  const { login, resetPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleReset() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email above first, then click \"Forgot password?\" again.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch {
      // Deliberately vague: don't reveal whether an account exists for
      // this email (avoids leaking which addresses are registered users).
      setResetSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      router.push("/dashboard");
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-neutral-600">Welcome back to NeighborShare.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button
          type="button"
          onClick={() => setResetMode((m) => !m)}
          className="text-xs text-emerald-700 hover:underline"
        >
          Forgot password?
        </button>

        {resetMode && (
          <div className="rounded-md bg-neutral-50 p-3">
            {resetSent ? (
              <p className="text-sm text-emerald-700">
                If an account exists for that email, a reset link is on its way.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                disabled={submitting}
                className="btn-secondary text-sm"
              >
                {submitting ? "Sending..." : `Send reset link to ${email || "this address"}`}
              </button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-emerald-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}

function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Incorrect email or password.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  return "Something went wrong logging in. Please try again.";
}
