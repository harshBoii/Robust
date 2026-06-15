import 'server-only';

import { prisma } from '@/lib/prisma';

/** Prisma client access until migration + generate (human-run). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type DbChatSession = {
  id: string;
  companyId: string;
  createdByUserId: string | null;
  title: string;
  status: string;
  currentStep: string;
  workflowState: unknown;
  bulkUploadId: string | null;
  campaignId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: DbChatMessage[];
};

export type DbChatMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string | null;
  widgetType: string | null;
  widgetPayload: unknown;
  createdAt: Date;
};

export async function listChatSessions(companyId: string, limit = 50) {
  return db.adChatSession.findMany({
    where: { companyId, status: { not: 'ARCHIVED' } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      currentStep: true,
      updatedAt: true,
      createdAt: true,
    },
  }) as Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      currentStep: string;
      updatedAt: Date;
      createdAt: Date;
    }>
  >;
}

export async function createChatSession(input: {
  companyId: string;
  createdByUserId?: string | null;
  title?: string;
  workflowState?: Record<string, unknown>;
}) {
  const welcome = await db.adChatSession.create({
    data: {
      companyId: input.companyId,
      createdByUserId: input.createdByUserId ?? null,
      title: input.title ?? 'New chat',
      currentStep: 'intent',
      workflowState: input.workflowState ?? {},
      messages: {
        create: {
          role: 'ASSISTANT',
          content:
            "Hey — I'm Miss Robusta. What are we promoting today? You can describe the product, paste a brief, or just say you want to post an ad.",
          widgetType: null,
        },
      },
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  return welcome as DbChatSession;
}

export async function getChatSession(id: string, companyId: string) {
  return db.adChatSession.findFirst({
    where: { id, companyId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  }) as Promise<DbChatSession | null>;
}

export async function updateChatSession(
  id: string,
  companyId: string,
  data: {
    title?: string;
    status?: string;
    pathType?: string | null;
    currentStep?: string;
    workflowState?: unknown;
    bulkUploadId?: string | null;
    campaignId?: string | null;
  },
) {
  return db.adChatSession.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/** Clear in-progress widgets once the step completes (avoids eternal spinners in history). */
export async function settleAnalyzingMessages(
  sessionId: string,
  opts: { groupCount?: number } = {},
) {
  await db.adChatMessage.updateMany({
    where: { sessionId, widgetType: 'mediaAnalyzing' },
    data: {
      widgetType: null,
      widgetPayload: { completed: true, groupCount: opts.groupCount ?? 0 },
    },
  });
}

export async function settleCreativeBuildingMessages(sessionId: string) {
  await db.adChatMessage.updateMany({
    where: { sessionId, widgetType: 'creativeBuilding' },
    data: { widgetType: null, widgetPayload: { completed: true } },
  });
}

export async function appendChatMessages(
  sessionId: string,
  rows: Array<{
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content?: string | null;
    widgetType?: string | null;
    widgetPayload?: unknown;
  }>,
) {
  const created = [];
  for (const row of rows) {
    const msg = await db.adChatMessage.create({
      data: {
        sessionId,
        role: row.role,
        content: row.content ?? null,
        widgetType: row.widgetType ?? null,
        widgetPayload: row.widgetPayload ?? undefined,
      },
    });
    created.push(msg);
  }
  return created as DbChatMessage[];
}
