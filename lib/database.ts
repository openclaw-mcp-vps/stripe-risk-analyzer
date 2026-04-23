import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

import type { PublicConnection, SnapshotRecord } from "@/lib/types";

type PurchaseSource = "stripe" | "lemonsqueezy";

export interface PurchaseRecord {
  email: string;
  source: PurchaseSource;
  purchasedAt: string;
  customerId?: string;
  sessionId?: string;
  eventId?: string;
}

export interface ConnectionRecord extends PublicConnection {
  encryptedStripeKey: string;
}

interface DatabaseSchema {
  purchases: PurchaseRecord[];
  connections: ConnectionRecord[];
  snapshots: SnapshotRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "database.json");

const DEFAULT_SCHEMA: DatabaseSchema = {
  purchases: [],
  connections: [],
  snapshots: []
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getEncryptionKey(): Buffer {
  const seed =
    process.env.DATA_ENCRYPTION_KEY ??
    process.env.ACCESS_TOKEN_SECRET ??
    "change-this-in-production-to-a-random-secret";

  return crypto.createHash("sha256").update(seed).digest();
}

async function ensureDatabaseFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_SCHEMA, null, 2), "utf8");
  }
}

async function readDatabase(): Promise<DatabaseSchema> {
  await ensureDatabaseFile();
  const contents = await fs.readFile(DB_FILE, "utf8");

  try {
    const parsed = JSON.parse(contents) as Partial<DatabaseSchema>;

    return {
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : []
    };
  } catch {
    return DEFAULT_SCHEMA;
  }
}

async function writeDatabase(data: DatabaseSchema): Promise<void> {
  await ensureDatabaseFile();
  const tempFile = `${DB_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tempFile, DB_FILE);
}

export function encryptSecret(secretValue: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secretValue, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, encryptedHex] = payload.split(":");

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Encrypted payload is malformed");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

export function toPublicConnection(record: ConnectionRecord): PublicConnection {
  const { encryptedStripeKey: _encryptedStripeKey, ...publicRecord } = record;
  return publicRecord;
}

export async function recordPurchase(input: {
  email: string;
  source: PurchaseSource;
  customerId?: string;
  sessionId?: string;
  eventId?: string;
}): Promise<PurchaseRecord> {
  const email = normalizeEmail(input.email);
  const db = await readDatabase();
  const existing = db.purchases.find((purchase) => purchase.email === email);
  const purchasedAt = new Date().toISOString();

  const record: PurchaseRecord = {
    email,
    source: input.source,
    purchasedAt,
    customerId: input.customerId,
    sessionId: input.sessionId,
    eventId: input.eventId
  };

  if (existing) {
    Object.assign(existing, record);
  } else {
    db.purchases.push(record);
  }

  await writeDatabase(db);

  return record;
}

export async function getPurchaseByEmail(email: string): Promise<PurchaseRecord | null> {
  const db = await readDatabase();
  const normalized = normalizeEmail(email);
  const purchase = db.purchases.find((item) => item.email === normalized);

  return purchase ?? null;
}

export async function upsertConnection(input: {
  ownerEmail: string;
  stripeAccountId: string;
  accountDisplayName: string;
  stripeSecretKey: string;
  alertEmail: string;
  riskThreshold: number;
  monitorEnabled: boolean;
}): Promise<ConnectionRecord> {
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const db = await readDatabase();
  const now = new Date().toISOString();
  const existing = db.connections.find((connection) => connection.ownerEmail === ownerEmail);

  const encryptedStripeKey = encryptSecret(input.stripeSecretKey);

  const nextRecord: ConnectionRecord = {
    ownerEmail,
    stripeAccountId: input.stripeAccountId,
    accountDisplayName: input.accountDisplayName,
    encryptedStripeKey,
    alertEmail: normalizeEmail(input.alertEmail),
    riskThreshold: input.riskThreshold,
    monitorEnabled: input.monitorEnabled,
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
    lastAlertAt: existing?.lastAlertAt,
    lastAnalysisAt: existing?.lastAnalysisAt,
    lastRiskScore: existing?.lastRiskScore
  };

  if (existing) {
    Object.assign(existing, nextRecord);
  } else {
    db.connections.push(nextRecord);
  }

  await writeDatabase(db);

  return nextRecord;
}

export async function updateConnectionHealth(
  ownerEmail: string,
  updates: {
    lastAnalysisAt?: string;
    lastRiskScore?: number;
    lastAlertAt?: string;
  }
): Promise<void> {
  const db = await readDatabase();
  const normalized = normalizeEmail(ownerEmail);
  const existing = db.connections.find((connection) => connection.ownerEmail === normalized);

  if (!existing) {
    return;
  }

  existing.lastAnalysisAt = updates.lastAnalysisAt ?? existing.lastAnalysisAt;
  existing.lastRiskScore = updates.lastRiskScore ?? existing.lastRiskScore;
  existing.lastAlertAt = updates.lastAlertAt ?? existing.lastAlertAt;
  existing.updatedAt = new Date().toISOString();

  await writeDatabase(db);
}

export async function getInternalConnectionByOwnerEmail(
  ownerEmail: string
): Promise<ConnectionRecord | null> {
  const db = await readDatabase();
  const normalized = normalizeEmail(ownerEmail);
  const record = db.connections.find((connection) => connection.ownerEmail === normalized);

  return record ?? null;
}

export async function getConnectionByOwnerEmail(ownerEmail: string): Promise<PublicConnection | null> {
  const record = await getInternalConnectionByOwnerEmail(ownerEmail);

  if (!record) {
    return null;
  }

  return toPublicConnection(record);
}

export async function deleteConnectionByOwnerEmail(ownerEmail: string): Promise<void> {
  const db = await readDatabase();
  const normalized = normalizeEmail(ownerEmail);
  db.connections = db.connections.filter((connection) => connection.ownerEmail !== normalized);
  await writeDatabase(db);
}

export async function listMonitoringConnections(): Promise<ConnectionRecord[]> {
  const db = await readDatabase();

  return db.connections.filter((connection) => connection.monitorEnabled);
}

export async function saveSnapshot(
  input: Omit<SnapshotRecord, "id" | "analyzedAt">
): Promise<SnapshotRecord> {
  const db = await readDatabase();

  const snapshot: SnapshotRecord = {
    ...input,
    id: crypto.randomUUID(),
    analyzedAt: new Date().toISOString()
  };

  db.snapshots.push(snapshot);

  db.snapshots = db.snapshots
    .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
    .slice(0, 5000);

  await writeDatabase(db);

  return snapshot;
}

export async function getLatestSnapshotByOwnerEmail(
  ownerEmail: string
): Promise<SnapshotRecord | null> {
  const snapshots = await listSnapshotsByOwnerEmail(ownerEmail, 1);
  return snapshots[0] ?? null;
}

export async function listSnapshotsByOwnerEmail(
  ownerEmail: string,
  limit = 20
): Promise<SnapshotRecord[]> {
  const db = await readDatabase();
  const normalized = normalizeEmail(ownerEmail);

  return db.snapshots
    .filter((snapshot) => snapshot.ownerEmail === normalized)
    .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
    .slice(0, limit);
}
