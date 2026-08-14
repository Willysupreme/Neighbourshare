"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { registerSchema } from "@/lib/validation/schemas";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { getPostAuthRedirect } from "@/lib/postAuthRedirect";

export default function RegisterPage() {
  const { register, firebaseUser, profile, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser) {
      router.replace(getPostAuthRedirect(profile));
    }
  }, [loading, firebaseUser, profile, router]);

  if (loading || firebaseUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data);
      // A brand new account never has a neighborhood chosen yet.
      router.push("/choose-neighborhood");
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="display-heading text-3xl">Create your account</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Join your neighborhood to borrow and lend tools and equipment.
      </p>

      <div className="mt-6">
        <GoogleAuthButton />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        or sign up with email
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </Field>

        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>

        <Field label="Password">
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-rust px-4 py-2 font-medium text-white hover:bg-rust-dark disabled:opacity-50"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-leaf">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "auth/email-already-in-use") return "An account with this email already exists.";
  if (code === "auth/weak-password") return "Password is too weak. Use at least 8 characters.";
  if (code === "auth/invalid-email") return "That email address doesn't look valid.";
  return "Something went wrong creating your account. Please try again.";
}
