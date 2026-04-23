"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClaimAccessForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({
    type: "idle",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setStatus({
        type: "error",
        message: "Enter the same email you used in Stripe Checkout."
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "claim_access",
          email
        })
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus({
          type: "error",
          message:
            payload.message ??
            "We could not confirm your purchase yet. Wait a minute for webhook sync and try again."
        });
        return;
      }

      setStatus({
        type: "success",
        message: "Access unlocked. Redirecting to your dashboard..."
      });

      router.push("/dashboard");
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to unlock access right now."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <LockKeyhole className="h-4 w-4 text-sky-400" />
        Already purchased? Unlock your dashboard
      </div>
      <Input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="founder@yourcompany.com"
      />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Unlock Dashboard
      </Button>
      {status.message ? (
        <p className={status.type === "error" ? "text-sm text-rose-300" : "text-sm text-emerald-300"}>
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
