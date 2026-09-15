import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Human-recognisable marker so leaked keys can be spotted in logs and scanners. */
const TOKEN_PREFIX = "ttk_";
/** Stored, non-secret head of the token used to narrow the hash comparison. */
const STORED_PREFIX_LENGTH = TOKEN_PREFIX.length + 8;

export interface CreatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  /** Full secret. Only ever available at creation time. */
  token: string;
}

export interface ApiKeyIdentity {
  keyId: string;
  keyName: string;
  projectId: string;
  ownerId: string;
  ownerEmail: string;
  ownerRole: Role;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  ownerName: string;
  ownerEmail: string;
}

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function apiKeyPrefix(token: string): string {
  return token.slice(0, STORED_PREFIX_LENGTH);
}

function generateToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createApiKey(
  projectId: string,
  name: string,
  userId: string,
): Promise<CreatedApiKey> {
  const token = generateToken();
  const record = await prisma.apiKey.create({
    data: {
      name,
      projectId,
      ownerId: userId,
      keyHash: hashApiKey(token),
      keyPrefix: apiKeyPrefix(token),
    },
  });

  return { id: record.id, name: record.name, keyPrefix: record.keyPrefix, token };
}

export async function verifyApiKey(token: string): Promise<ApiKeyIdentity | null> {
  const trimmed = token.trim();
  if (!trimmed.startsWith(TOKEN_PREFIX) || trimmed.length <= STORED_PREFIX_LENGTH) {
    return null;
  }

  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: apiKeyPrefix(trimmed), revokedAt: null },
    include: { owner: { select: { id: true, email: true, role: true, active: true } } },
  });

  const expectedHash = hashApiKey(trimmed);
  const match = candidates.find(
    (candidate) => candidate.owner.active && hashesMatch(candidate.keyHash, expectedHash),
  );
  if (!match) return null;

  await prisma.apiKey.update({
    where: { id: match.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    keyId: match.id,
    keyName: match.name,
    projectId: match.projectId,
    ownerId: match.owner.id,
    ownerEmail: match.owner.email,
    ownerRole: match.owner.role,
  };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });
}

export async function listApiKeys(projectId: string): Promise<ApiKeySummary[]> {
  const keys = await prisma.apiKey.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    ownerName: key.owner.name,
    ownerEmail: key.owner.email,
  }));
}
