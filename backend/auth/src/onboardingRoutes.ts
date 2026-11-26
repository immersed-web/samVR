import { RequestHandler, Router, Request } from 'express';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from 'database';
import { hasAtLeastSecurityRole, OrganizationIdSchema, UnitIdSchema, type OrganizationId, type UnitId, type UserId } from 'schemas';
import { isLoggedIn } from './utils.js';

/**
 * Onboarding of organizations and people:
 *  - Public: a request form for prospective organizations, and viewing/accepting an invitation.
 *  - Platform admin: review requests (approving creates the organization and a first-admin invitation).
 *  - Organization/unit admins: create, list and revoke invitations.
 *
 * Invitation codes are random and are only stored as a SHA-256 hash, so they can be shown once
 * when created and cannot be read back from the database. There is no e-mail sending: whoever
 * creates an invitation hands the link over themselves.
 */

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/* ------------------------------ tiny rate limiter ------------------------------ */
// In-memory sliding window, per key. Good enough to blunt form spam and code guessing on a single instance.
const hits = new Map<string, number[]>();
export function rateLimit(bucket: string, max: number, windowMs: number): RequestHandler {
  return (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
    if (recent.length >= max) {
      res.status(429).send({ message: 'För många försök. Vänta en stund och försök igen.' });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
    next();
  };
}

/* ---------------------------------- helpers ---------------------------------- */

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');
// Timestamps are stored as UTC clock times (timestamp without time zone, written by drizzle from JS Dates),
// so every comparison with "now" must be made against the UTC clock, in the database, never mixed with JS time.
const utcNow = sql`(now() at time zone 'utc')`;
const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

type Caller = { userId: UserId; role: typeof schema.users.$inferSelect['role'] };
async function loadCaller(req: Request): Promise<Caller> {
  const userId = req.session.userId as UserId | undefined;
  if (!userId) throw new HttpError(403, 'Not logged in');
  const [caller] = await db.select({ userId: schema.users.userId, role: schema.users.role }).from(schema.users).where(eq(schema.users.userId, userId));
  if (!caller || caller.role === 'guest') throw new HttpError(403, 'Not authorized');
  return caller;
}
const isPlatformAdmin = (caller: Caller) => hasAtLeastSecurityRole(caller.role, 'superadmin');

async function isOrgAdmin(caller: Caller, organizationId: OrganizationId) {
  const [m] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, caller.userId), eq(schema.organizationMembers.organizationId, organizationId)));
  return m?.role === 'org_admin';
}
async function isUnitAdmin(caller: Caller, unitId: UnitId) {
  const [m] = await db.select({ role: schema.unitMembers.role }).from(schema.unitMembers)
    .where(and(eq(schema.unitMembers.userId, caller.userId), eq(schema.unitMembers.unitId, unitId)));
  return m?.role === 'unit_admin';
}

function handle(fn: (req: Request, res: Parameters<RequestHandler>[1]) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      if (!res.headersSent) res.send(result ?? { ok: true });
    } catch (e) {
      if (res.headersSent) return;
      if (e instanceof HttpError) { res.status(e.status).send({ message: e.message }); return; }
      if (e instanceof z.ZodError) { res.status(400).send({ message: 'Invalid input', issues: e.issues.map(i => `${i.path.join('.')}: ${i.message}`) }); return; }
      const pgError = e as { code?: string; cause?: { code?: string } };
      const code = pgError?.code ?? pgError?.cause?.code;
      if (code === '23505') { res.status(409).send({ message: 'Already exists' }); return; }
      console.error('onboarding route error:', e);
      res.status(500).send({ message: 'Internal error' });
    }
  };
}
const platformAdminOnly = async (req: Request) => { const c = await loadCaller(req); if (!isPlatformAdmin(c)) throw new HttpError(403, 'Only platform administrators can do this'); return c; };

const INVALID_INVITATION = 'Inbjudan är ogiltig eller har gått ut.';

/* ------------------------------ public: request form ------------------------------ */

const MAX_OPEN_REQUESTS = 200;

const submitRequest = handle(async req => {
  const input = z.object({
    organizationName: z.string().trim().min(2).max(200),
    organizationType: z.enum(schema.OrganizationTypeEnum.enumValues).default('other'),
    contactName: z.string().trim().min(2).max(200),
    contactEmail: z.string().trim().email().max(320),
    expectedUsers: z.number().int().min(1).max(1_000_000).optional(),
    message: z.string().trim().max(4000).optional(),
    // Honeypot: real people never see or fill this in, bots do.
    website: z.string().max(0).optional(),
  }).parse(req.body);
  const { website: _honeypot, ...data } = input;

  const [{ open }] = await db.select({ open: sql<number>`count(*)::int` }).from(schema.organizationRequests).where(eq(schema.organizationRequests.status, 'requested'));
  if (open >= MAX_OPEN_REQUESTS) throw new HttpError(503, 'Vi kan inte ta emot fler förfrågningar just nu. Försök igen senare.');

  await db.insert(schema.organizationRequests).values({ ...data, message: data.message || null });
  return { ok: true };
});

/* ---------------------------- platform admin: requests ---------------------------- */

const listRequests = handle(async req => {
  await platformAdminOnly(req);
  const status = z.enum(schema.RequestStatusEnum.enumValues).optional().parse(req.query.status);
  const query = db.select().from(schema.organizationRequests);
  return (status ? query.where(eq(schema.organizationRequests.status, status)) : query).orderBy(desc(schema.organizationRequests.createdAt)).limit(500);
});

const approveRequest = handle(async req => {
  const caller = await platformAdminOnly(req);
  const input = z.object({
    requestId: z.string().uuid(),
    // The admin may correct the name (for example if it clashes with an existing organization).
    organizationName: z.string().trim().min(1).max(200).optional(),
  }).parse(req.body);
  const token = newToken();
  const result = await db.transaction(async tx => {
    const [request] = await tx.select().from(schema.organizationRequests)
      .where(eq(schema.organizationRequests.requestId, input.requestId)).for('update');
    if (!request) throw new HttpError(404, 'Request not found');
    if (request.status !== 'requested') throw new HttpError(409, 'The request has already been handled');
    const [organization] = await tx.insert(schema.organizations)
      .values({ name: input.organizationName ?? request.organizationName, type: request.organizationType }).returning();
    await tx.insert(schema.invitations).values({
      tokenHash: hashToken(token),
      organizationId: organization.organizationId,
      organizationRole: 'org_admin',
      note: `Första administratör: ${request.contactName} (${request.contactEmail})`,
      maxUses: 1,
      expiresAt: days(14),
      createdByUserId: caller.userId,
    });
    await tx.update(schema.organizationRequests).set({
      status: 'approved', createdOrganizationId: organization.organizationId, handledByUserId: caller.userId, handledAt: new Date(),
    }).where(eq(schema.organizationRequests.requestId, input.requestId));
    return { organization, contactEmail: request.contactEmail, contactName: request.contactName };
  });
  // The code is returned exactly once. Send the invitation link to the contact person yourself.
  return { ...result, token, expiresInDays: 14 };
});

const rejectRequest = handle(async req => {
  const caller = await platformAdminOnly(req);
  const { requestId } = z.object({ requestId: z.string().uuid() }).parse(req.body);
  const updated = await db.update(schema.organizationRequests)
    .set({ status: 'rejected', handledByUserId: caller.userId, handledAt: new Date() })
    .where(and(eq(schema.organizationRequests.requestId, requestId), eq(schema.organizationRequests.status, 'requested')))
    .returning({ id: schema.organizationRequests.requestId });
  if (!updated.length) throw new HttpError(409, 'The request does not exist or has already been handled');
});

/* ------------------------------- invitation admin ------------------------------- */

const createInvitation = handle(async req => {
  const caller = await loadCaller(req);
  const input = z.object({
    organizationId: OrganizationIdSchema,
    unitId: UnitIdSchema.nullable().default(null),
    organizationRole: z.enum(schema.OrganizationRoleEnum.enumValues).default('member'),
    unitRole: z.enum(schema.UnitRoleEnum.enumValues).default('member'),
    expiresInDays: z.number().int().min(1).max(90).default(14),
    maxUses: z.number().int().min(1).max(500).default(1),
    note: z.string().trim().max(500).optional(),
  }).parse(req.body);

  if (input.unitId) {
    const [unit] = await db.select({ id: schema.units.unitId }).from(schema.units)
      .where(and(eq(schema.units.unitId, input.unitId), eq(schema.units.organizationId, input.organizationId)));
    if (!unit) throw new HttpError(400, 'The unit does not belong to that organization');
  }
  const manager = isPlatformAdmin(caller) || await isOrgAdmin(caller, input.organizationId);
  if (!manager) {
    // A unit admin may invite plain members into their own unit, nothing more.
    const ok = !!input.unitId && await isUnitAdmin(caller, input.unitId) && ['member', 'basic'].includes(input.organizationRole);
    if (!ok) throw new HttpError(403, 'Not authorized to invite here');
  }

  const token = newToken();
  const [created] = await db.insert(schema.invitations).values({
    tokenHash: hashToken(token),
    organizationId: input.organizationId,
    unitId: input.unitId,
    organizationRole: input.organizationRole,
    unitRole: input.unitId ? input.unitRole : 'member',
    note: input.note || null,
    maxUses: input.maxUses,
    expiresAt: days(input.expiresInDays),
    createdByUserId: caller.userId,
  }).returning({ invitationId: schema.invitations.invitationId, expiresAt: schema.invitations.expiresAt });
  return { ...created, token };
});

const listInvitations = handle(async req => {
  const caller = await loadCaller(req);
  const organizationId = OrganizationIdSchema.parse(req.params.organizationId);
  if (!isPlatformAdmin(caller) && !(await isOrgAdmin(caller, organizationId))) throw new HttpError(403, 'Not authorized');
  return db.select({
    invitationId: schema.invitations.invitationId,
    unitId: schema.invitations.unitId,
    organizationRole: schema.invitations.organizationRole,
    unitRole: schema.invitations.unitRole,
    note: schema.invitations.note,
    maxUses: schema.invitations.maxUses,
    usedCount: schema.invitations.usedCount,
    expiresAt: schema.invitations.expiresAt,
    revokedAt: schema.invitations.revokedAt,
    createdAt: schema.invitations.createdAt,
  }).from(schema.invitations).where(eq(schema.invitations.organizationId, organizationId)).orderBy(desc(schema.invitations.createdAt)).limit(200);
});

const revokeInvitation = handle(async req => {
  const caller = await loadCaller(req);
  const { invitationId } = z.object({ invitationId: z.string().uuid() }).parse(req.body);
  const [inv] = await db.select({ organizationId: schema.invitations.organizationId, unitId: schema.invitations.unitId }).from(schema.invitations)
    .where(eq(schema.invitations.invitationId, invitationId));
  if (!inv) throw new HttpError(404, 'Invitation not found');
  const allowed = isPlatformAdmin(caller) || await isOrgAdmin(caller, inv.organizationId) || (!!inv.unitId && await isUnitAdmin(caller, inv.unitId));
  if (!allowed) throw new HttpError(403, 'Not authorized');
  await db.update(schema.invitations).set({ revokedAt: new Date() }).where(and(eq(schema.invitations.invitationId, invitationId), sql`${schema.invitations.revokedAt} is null`));
});

/* ------------------------- public: view and accept an invitation ------------------------- */

const tokenSchema = z.string().min(20).max(200);

async function findValidInvitation(token: string) {
  const [inv] = await db.select({
    invitationId: schema.invitations.invitationId,
    organizationId: schema.invitations.organizationId,
    organizationName: schema.organizations.name,
    unitId: schema.invitations.unitId,
    unitName: schema.units.name,
    organizationRole: schema.invitations.organizationRole,
    unitRole: schema.invitations.unitRole,
    expiresAt: schema.invitations.expiresAt,
  }).from(schema.invitations)
    .innerJoin(schema.organizations, eq(schema.organizations.organizationId, schema.invitations.organizationId))
    .leftJoin(schema.units, eq(schema.units.unitId, schema.invitations.unitId))
    .where(and(
      eq(schema.invitations.tokenHash, hashToken(token)),
      sql`${schema.invitations.revokedAt} is null`,
      sql`${schema.invitations.expiresAt} > ${utcNow}`,
      sql`${schema.invitations.usedCount} < ${schema.invitations.maxUses}`,
    ));
  return inv;
}

const previewInvitation = handle(async req => {
  const token = tokenSchema.safeParse(req.params.token);
  const inv = token.success ? await findValidInvitation(token.data) : undefined;
  // Same answer for "never existed", "expired", "revoked" and "used up", so codes cannot be probed.
  if (!inv) throw new HttpError(410, INVALID_INVITATION);
  // If the visitor is signed in, say as whom, so the page can offer to join with that account.
  let username: string | null = null;
  if (req.session.userId) {
    const [u] = await db.select({ username: schema.users.username, role: schema.users.role }).from(schema.users).where(eq(schema.users.userId, req.session.userId as UserId));
    if (u && u.role !== 'guest') username = u.username;
  }
  return {
    organizationName: inv.organizationName,
    unitName: inv.unitName,
    organizationRole: inv.organizationRole,
    expiresAt: inv.expiresAt,
    loggedIn: !!username,
    username,
  };
});

const acceptInvitation = handle(async req => {
  const input = z.object({
    token: tokenSchema,
    username: z.string().trim().min(2).max(100).optional(),
    password: z.string().min(8).max(200).optional(),
  }).parse(req.body);

  let existingUser: { userId: UserId; role: Caller['role'] } | undefined;
  if (req.session.userId) {
    const [u] = await db.select({ userId: schema.users.userId, role: schema.users.role }).from(schema.users).where(eq(schema.users.userId, req.session.userId as UserId));
    existingUser = u;
  }
  if (existingUser && (existingUser.role === 'guest' || hasAtLeastSecurityRole(existingUser.role, 'superadmin'))) {
    throw new HttpError(400, 'Det här kontot kan inte gå med i en organisation via en inbjudan.');
  }
  if (!existingUser && (!input.username || !input.password)) throw new HttpError(400, 'Ange användarnamn och lösenord för att skapa ditt konto.');
  const passwordHash = !existingUser ? await bcrypt.hash(input.password!, 10) : undefined;

  const outcome = await db.transaction(async tx => {
    const [inv] = await tx.select({ invitation: schema.invitations, expired: sql<boolean>`${schema.invitations.expiresAt} <= ${utcNow}` }).from(schema.invitations)
      .where(eq(schema.invitations.tokenHash, hashToken(input.token))).for('update').then(rows => rows.map(r => ({ ...r.invitation, expired: r.expired })));
    if (!inv || inv.revokedAt || inv.expired || inv.usedCount >= inv.maxUses) throw new HttpError(410, INVALID_INVITATION);

    let user: { userId: UserId; username: string; role: Caller['role'] };
    if (existingUser) {
      const [u] = await tx.select({ userId: schema.users.userId, username: schema.users.username, role: schema.users.role }).from(schema.users).where(eq(schema.users.userId, existingUser.userId));
      user = u;
      const [already] = await tx.select({ r: schema.organizationMembers.role }).from(schema.organizationMembers)
        .where(and(eq(schema.organizationMembers.userId, user.userId), eq(schema.organizationMembers.organizationId, inv.organizationId)));
      if (already) throw new HttpError(409, 'Du är redan medlem i den här organisationen.');
    } else {
      try {
        [user] = await tx.insert(schema.users).values({ username: input.username!, password: passwordHash!, role: 'user' })
          .returning({ userId: schema.users.userId, username: schema.users.username, role: schema.users.role });
      } catch (e) {
        const pgError = e as { code?: string; cause?: { code?: string } };
        if ((pgError?.code ?? pgError?.cause?.code) === '23505') throw new HttpError(409, 'Användarnamnet är upptaget. Välj ett annat.');
        throw e;
      }
    }
    await tx.insert(schema.organizationMembers).values({ userId: user.userId, organizationId: inv.organizationId, role: inv.organizationRole });
    if (inv.unitId) {
      await tx.insert(schema.unitMembers).values({ userId: user.userId, unitId: inv.unitId, organizationId: inv.organizationId, role: inv.unitRole });
    }
    await tx.update(schema.invitations).set({ usedCount: inv.usedCount + 1 }).where(eq(schema.invitations.invitationId, inv.invitationId));
    const [org] = await tx.select({ name: schema.organizations.name }).from(schema.organizations).where(eq(schema.organizations.organizationId, inv.organizationId));
    return { user, organizationName: org.name, createdAccount: !existingUser };
  });

  // A brand-new account is signed in straight away, like a normal login.
  if (outcome.createdAccount) {
    req.session.userId = outcome.user.userId;
    req.session.user = { userId: outcome.user.userId, username: outcome.user.username, role: outcome.user.role };
  }
  return { ok: true, organizationName: outcome.organizationName, createdAccount: outcome.createdAccount, username: outcome.user.username };
});

export default function createOnboardingRouter(): Router {
  const router = Router();
  // public
  router.post('/request', rateLimit('request', 5, 60 * 60 * 1000), submitRequest);
  router.get('/invitation/:token', rateLimit('invitation', 40, 15 * 60 * 1000), previewInvitation);
  router.post('/accept', rateLimit('accept', 20, 15 * 60 * 1000), acceptInvitation);
  // platform admin
  router.get('/requests', isLoggedIn, listRequests);
  router.post('/requests/approve', isLoggedIn, approveRequest);
  router.post('/requests/reject', isLoggedIn, rejectRequest);
  // organization / unit admins
  router.post('/invitations/create', isLoggedIn, createInvitation);
  router.get('/invitations/:organizationId', isLoggedIn, listInvitations);
  router.post('/invitations/revoke', isLoggedIn, revokeInvitation);
  return router;
}
