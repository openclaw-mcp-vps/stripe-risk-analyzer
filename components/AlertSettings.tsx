"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bell, LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PublicConnection } from "@/lib/types";

interface AlertSettingsProps {
  ownerEmail: string;
  connection: PublicConnection | null;
  onConnectionChange: (nextConnection: PublicConnection | null) => void;
}

export default function AlertSettings({
  ownerEmail,
  connection,
  onConnectionChange
}: AlertSettingsProps) {
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [alertEmail, setAlertEmail] = useState(connection?.alertEmail ?? ownerEmail);
  const [riskThreshold, setRiskThreshold] = useState(connection?.riskThreshold ?? 65);
  const [monitorEnabled, setMonitorEnabled] = useState(connection?.monitorEnabled ?? true);
  const [status, setStatus] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    setAlertEmail(connection?.alertEmail ?? ownerEmail);
    setRiskThreshold(connection?.riskThreshold ?? 65);
    setMonitorEnabled(connection?.monitorEnabled ?? true);
  }, [connection, ownerEmail]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "connect_account",
          stripeSecretKey: stripeSecretKey.trim() || undefined,
          alertEmail,
          riskThreshold,
          monitorEnabled
        })
      });

      const payload = (await response.json()) as {
        message?: string;
        connection?: PublicConnection;
      };

      if (!response.ok || !payload.connection) {
        setStatus(payload.message ?? "Unable to save alert settings.");
        return;
      }

      setStripeSecretKey("");
      onConnectionChange(payload.connection);
      setStatus("Alert settings saved. Monitoring is active for your Stripe account.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save alert settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    setStatus("");

    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "disconnect_account"
        })
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus(payload.message ?? "Unable to disconnect account.");
        return;
      }

      onConnectionChange(null);
      setStripeSecretKey("");
      setStatus("Saved Stripe credentials were removed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to disconnect account.");
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-sky-400" />
          Alert Settings
        </CardTitle>
        <CardDescription>
          Store Stripe credentials securely for background monitoring and email alerts when your risk score spikes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="space-y-1.5">
            <label htmlFor="stripeSecretKey" className="text-sm font-medium text-slate-200">
              Stripe Secret Key
            </label>
            <Input
              id="stripeSecretKey"
              type="password"
              autoComplete="off"
              value={stripeSecretKey}
              onChange={(event) => setStripeSecretKey(event.target.value)}
              placeholder={connection ? "Optional: provide a new key to rotate credentials" : "sk_live_..."}
            />
            <p className="text-xs text-slate-400">
              {connection
                ? "Leave blank to keep your existing key."
                : "Required the first time you enable background monitoring."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="alertEmail" className="text-sm font-medium text-slate-200">
              Alert Email
            </label>
            <Input
              id="alertEmail"
              type="email"
              value={alertEmail}
              onChange={(event) => setAlertEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="riskThreshold" className="text-sm font-medium text-slate-200">
              Alert Threshold (0-100)
            </label>
            <Input
              id="riskThreshold"
              type="number"
              min={25}
              max={95}
              value={riskThreshold}
              onChange={(event) => setRiskThreshold(Number(event.target.value))}
              required
            />
          </div>

          <label className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-sky-500"
              checked={monitorEnabled}
              onChange={(event) => setMonitorEnabled(event.target.checked)}
            />
            Enable background monitoring and automatic email alerts
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save Alert Settings
            </Button>
            {connection ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Disconnect
              </Button>
            ) : null}
          </div>
          {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
