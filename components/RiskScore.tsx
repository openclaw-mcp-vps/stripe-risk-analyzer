import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskAssessment } from "@/lib/types";

interface RiskScoreProps {
  risk: RiskAssessment | null;
}

function scoreColor(level: RiskAssessment["level"]): string {
  if (level === "critical") {
    return "#ef4444";
  }

  if (level === "high") {
    return "#f97316";
  }

  if (level === "moderate") {
    return "#facc15";
  }

  return "#22c55e";
}

function levelLabel(level: RiskAssessment["level"]): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export default function RiskScore({ risk }: RiskScoreProps) {
  if (!risk) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Suspension Risk Score</CardTitle>
          <CardDescription>Run your first analysis to generate a real risk score and action plan.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const color = scoreColor(risk.level);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {risk.level === "low" ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-rose-400" />
          )}
          Suspension Risk Score
        </CardTitle>
        <CardDescription>{risk.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <div
            className="relative grid h-28 w-28 place-items-center rounded-full"
            style={{
              background: `conic-gradient(${color} ${risk.score * 3.6}deg, rgba(30,41,59,0.8) 0deg)`
            }}
          >
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#0d1117] text-center">
              <div className="text-2xl font-bold text-slate-100">{risk.score}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">/ 100</div>
            </div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.16em] text-slate-400">Current Level</div>
            <div className="mt-1 text-2xl font-semibold" style={{ color }}>
              {levelLabel(risk.level)}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">What is driving this score</h4>
          <ul className="space-y-2 text-sm text-slate-300">
            {risk.triggers.map((trigger) => (
              <li key={trigger} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>{trigger}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">Recommended next steps</h4>
          <ul className="space-y-2 text-sm text-slate-300">
            {risk.recommendations.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
