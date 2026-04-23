export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface StripeAccountSummary {
  id: string;
  displayName: string;
  country: string;
  businessType: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDueCount: number;
}

export interface StripeAccountMetrics {
  windowDays: number;
  totalCharges: number;
  successfulCharges: number;
  failedCharges: number;
  grossVolume: number;
  refundedVolume: number;
  refundRate: number;
  disputeCount: number;
  disputeRate: number;
  chargebackAmount: number;
  failedChargeRate: number;
  highRiskCountryRatio: number;
  averageTicket: number;
  payoutFailures: number;
}

export interface ChargeTimelinePoint {
  date: string;
  successful: number;
  failed: number;
  disputes: number;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  summary: string;
  triggers: string[];
  recommendations: string[];
}

export interface StripeAnalysisResult {
  account: StripeAccountSummary;
  metrics: StripeAccountMetrics;
  risk: RiskAssessment;
  timeline: ChargeTimelinePoint[];
}

export interface SnapshotRecord extends StripeAnalysisResult {
  id: string;
  ownerEmail: string;
  analyzedAt: string;
  windowDays: number;
}

export interface PublicConnection {
  ownerEmail: string;
  stripeAccountId: string;
  accountDisplayName: string;
  alertEmail: string;
  riskThreshold: number;
  monitorEnabled: boolean;
  connectedAt: string;
  updatedAt: string;
  lastAnalysisAt?: string;
  lastRiskScore?: number;
  lastAlertAt?: string;
}
