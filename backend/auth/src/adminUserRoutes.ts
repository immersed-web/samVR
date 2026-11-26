import { RequestHandler, Router, Request } from 'express';
import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from 'database';
import { hasAtLeastSecurityRole, OrganizationIdSchema, roleHierarchy, UserIdSchema, type UserId } from 'schemas';
import { isLoggedIn } from './utils.js';

/**
 * Account management for platform administrators ("Hantera användare").
 * Every handler re-reads the caller's role from the database and refuses anyone below superadmin.
 * Accounts can only be changed by someone with a strictly higher global role, and never by themselves.
 */

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Caller = { userId: UserId; role: (typeof roleHierarchy)[number] };

async function loadAdmin(req: Request): Promise<Caller> {
  const userId = req.session.userId as UserId | undefined;
  if (!userId) throw new HttpError(403, 'Not logged in');
  const [caller] = await db.select({ userId: schema.users.userId, role: schema.users.role }).from(schema.users).where(eq(schema.users.userId, userId));
  if (!caller || !hasAtLeastSecurityRole(caller.role, 'superadmin')) throw new HttpError(403, 'Bara plattformsadministratören kan göra detta');
  return caller;
}

function wrap(handler: (req: Request, caller: Caller) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try {
      const caller = await loadAdmin(req);
      res.send((await handler(req, caller)) ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) { res.status(e.status).send({ message: e.message }); return; }
      if (e instanceof z.ZodError) { res.status(400).send({ message: 'Ogiltiga uppgifter', issues: e.issues.map(i => `${i.path.join('.')}: ${i.message}`) }); return; }
      const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
      if (code === '23505') { res.status(409).send({ message: 'Användarnamnet är redan upptaget' }); return; }
      if (code === '23503') { res.status(409).send({ message: 'Kan inte ändras eftersom annan data är beroende av det' }); return; }
      console.error('admin user route error:', e);
      res.status(500).send({ message: 'Internal error' });
    }
  };
}

/** Lower index in roleHierarchy = more privileged. */
const level = (role: string) => roleHierarchy.indexOf(role as Caller['role']);
const utcNow = sql`(now() at time zone 'utc')`;

async function loadTarget(caller: Caller, userId: UserId, { allowSelf = false } = {}) {
  const [target] = await db.select({
    userId: schema.users.userId, username: schema.users.username, role: schema.users.role, blockedAt: schema.users.blockedAt,
  }).from(schema.users).where(eq(schema.users.userId, userId));
  if (!target) throw new HttpError(404, 'Användaren finns inte');
  if (target.userId === caller.userId && !allowSelf) throw new HttpError(400, 'Du kan inte göra detta med ditt eget konto');
  if (target.userId !== caller.userId && level(caller.role) >= level(target.role)) {
    throw new HttpError(403, 'Du kan bara hantera konton med lägre roll än din egen');
  }
  return target;
}

/** Ends every login session of an account (the session store is shared with the rest of the auth server). */
export async function endSessions(userId: UserId) {
  await db.execute(sql`delete from "session" where (sess::jsonb) ->> 'userId' = ${userId}`);
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/l/I)
export function generatePassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m);

/* ---------------------------------- list ---------------------------------- */

const listUsers = wrap(async (req) => {
  const q = z.object({
    search: z.string().trim().max(100).default(''),
    role: z.enum(roleHierarchy).optional(),
    status: z.enum(['all', 'active', 'blocked']).default('all'),
    org: z.union([z.literal('none'), OrganizationIdSchema]).optional(),
    sort: z.enum(['username', 'createdAt', 'lastLoginAt', 'role']).default('username'),
    order: z.enum(['asc', 'desc']).default('asc'),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }).parse(req.query);

  const conditions: (SQL | undefined)[] = [];
  if (q.search) {
    const pattern = `%${likeEscape(q.search)}%`;
    conditions.push(or(
      ilike(schema.users.username, pattern),
      sql`exists (select 1 from "OrganizationMembers" m join "Organizations" o on o."organizationId" = m."organizationId" where m."userId" = ${schema.users.userId} and o.name ilike ${pattern})`,
    ));
  }
  if (q.role) conditions.push(eq(schema.users.role, q.role));
  if (q.status === 'blocked') conditions.push(isNotNull(schema.users.blockedAt));
  if (q.status === 'active') conditions.push(isNull(schema.users.blockedAt));
  if (q.org === 'none') conditions.push(sql`not exists (select 1 from "OrganizationMembers" m where m."userId" = ${schema.users.userId})`);
  else if (q.org) conditions.push(sql`exists (select 1 from "OrganizationMembers" m where m."userId" = ${schema.users.userId} and m."organizationId" = ${q.org})`);
  const where = and(...conditions);

  const direction = q.order === 'desc' ? desc : asc;
  const orderColumn = q.sort === 'role'
    ? sql`array_position(enum_range(null::"Role"), ${schema.users.role})`
    : schema.users[q.sort];
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.users).where(where);
  const rows = await db.select({
    userId: schema.users.userId,
    username: schema.users.username,
    role: schema.users.role,
    createdAt: schema.users.createdAt,
    lastLoginAt: schema.users.lastLoginAt,
    blockedAt: schema.users.blockedAt,
    blockedReason: schema.users.blockedReason,
    spaceCount: sql<number>`(select count(*)::int from "VrSpaces" s where s."ownerUserId" = "Users"."userId")`,
  }).from(schema.users).where(where)
    .orderBy(direction(orderColumn), asc(schema.users.username))
    .limit(q.limit).offset(q.offset);

  const ids = rows.map(r => r.userId);
  const memberships = ids.length ? await db.select({
    userId: schema.organizationMembers.userId,
    organizationId: schema.organizations.organizationId,
    name: schema.organizations.name,
    role: schema.organizationMembers.role,
  }).from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.organizationId, schema.organizationMembers.organizationId))
    .where(inArray(schema.organizationMembers.userId, ids)).orderBy(asc(schema.organizations.name)) : [];
  return {
    total,
    users: rows.map(r => ({ ...r, organizations: memberships.filter(m => m.userId === r.userId).map(({ userId: _u, ...m }) => m) })),
  };
});

const summary = wrap(async () => {
  const [counts] = await db.select({
    total: sql<number>`count(*)::int`,
    blocked: sql<number>`(count(*) filter (where ${schema.users.blockedAt} is not null))::int`,
    withoutOrganization: sql<number>`(count(*) filter (where not exists (select 1 from "OrganizationMembers" m where m."userId" = "Users"."userId")))::int`,
    neverLoggedIn: sql<number>`(count(*) filter (where ${schema.users.lastLoginAt} is null))::int`,
  }).from(schema.users);
  const byRole = await db.select({ role: schema.users.role, count: sql<number>`count(*)::int` }).from(schema.users).groupBy(schema.users.role);
  const organizations = await db.select({ organizationId: schema.organizations.organizationId, name: schema.organizations.name })
    .from(schema.organizations).orderBy(asc(schema.organizations.name));
  return { ...counts, byRole, organizations };
});

/* --------------------------------- details -------------------------------- */

const getUser = wrap(async (req, caller) => {
  const userId = UserIdSchema.parse(req.params.userId);
  const [user] = await db.select({
    userId: schema.users.userId, username: schema.users.username, role: schema.users.role,
    createdAt: schema.users.createdAt, lastLoginAt: schema.users.lastLoginAt, blockedAt: schema.users.blockedAt, blockedReason: schema.users.blockedReason,
  }).from(schema.users).where(eq(schema.users.userId, userId));
  if (!user) throw new HttpError(404, 'Användaren finns inte');
  const organizations = await db.select({
    organizationId: schema.organizations.organizationId, name: schema.organizations.name, role: schema.organizationMembers.role,
  }).from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.organizationId, schema.organizationMembers.organizationId))
    .where(eq(schema.organizationMembers.userId, userId)).orderBy(asc(schema.organizations.name));
  const units = await db.select({ name: schema.units.name, organizationId: schema.units.organizationId, role: schema.unitMembers.role })
    .from(schema.unitMembers).innerJoin(schema.units, eq(schema.units.unitId, schema.unitMembers.unitId)).where(eq(schema.unitMembers.userId, userId));
  const departments = await db.select({ name: schema.departments.name, unitId: schema.departments.unitId })
    .from(schema.departmentMembers).innerJoin(schema.departments, eq(schema.departments.departmentId, schema.departmentMembers.departmentId))
    .where(eq(schema.departmentMembers.userId, userId));
  const spaces = await db.select({ vrSpaceId: schema.vrSpaces.vrSpaceId, name: schema.vrSpaces.name, visibility: schema.vrSpaces.visibility, organizationId: schema.vrSpaces.organizationId })
    .from(schema.vrSpaces).where(eq(schema.vrSpaces.ownerUserId, userId)).orderBy(asc(schema.vrSpaces.name)).limit(100);
  const [{ received, unread }] = await db.select({
    received: sql<number>`count(*)::int`, unread: sql<number>`(count(*) filter (where ${schema.userMessages.readAt} is null))::int`,
  }).from(schema.userMessages).where(eq(schema.userMessages.userId, userId));
  return {
    user, organizations, units, departments, spaces, messages: { received, unread },
    canManage: userId !== caller.userId && level(caller.role) < level(user.role),
    assignableRoles: roleHierarchy.filter(r => level(r) > level(caller.role) && r !== 'guest'),
  };
});

/* --------------------------------- actions -------------------------------- */

const usernameSchema = z.string().trim().min(2).max(100);

const createUser = wrap(async (req, caller) => {
  const input = z.object({
    username: usernameSchema,
    password: z.string().min(8).max(200).optional(),
    role: z.enum(roleHierarchy).default('user'),
  }).parse(req.body);
  if (input.role === 'guest' || level(input.role) <= level(caller.role)) throw new HttpError(403, 'Du kan bara skapa konton med lägre roll än din egen');
  const password = input.password ?? generatePassword();
  const [created] = await db.insert(schema.users).values({ username: input.username, password: await bcrypt.hash(password, 10), role: input.role })
    .returning({ userId: schema.users.userId, username: schema.users.username });
  return { ...created, password: input.password ? undefined : password };
});

const updateUser = wrap(async (req, caller) => {
  const input = z.object({ userId: UserIdSchema, username: usernameSchema.optional(), role: z.enum(roleHierarchy).optional() }).parse(req.body);
  if (input.username === undefined && input.role === undefined) throw new HttpError(400, 'Inget att ändra');
  const target = await loadTarget(caller, input.userId);
  if (input.role !== undefined && (input.role === 'guest' || level(input.role) <= level(caller.role))) {
    throw new HttpError(403, 'Du kan bara ge roller som är lägre än din egen');
  }
  await db.update(schema.users).set({
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
  }).where(eq(schema.users.userId, target.userId));
  if (input.role !== undefined && input.role !== target.role) await endSessions(target.userId); // the new role applies from the next login
});

const resetPassword = wrap(async (req, caller) => {
  const input = z.object({ userId: UserIdSchema, password: z.string().min(8).max(200).optional() }).parse(req.body);
  const target = await loadTarget(caller, input.userId);
  const password = input.password ?? generatePassword();
  await db.update(schema.users).set({ password: await bcrypt.hash(password, 10) }).where(eq(schema.users.userId, target.userId));
  await endSessions(target.userId); // everyone logged in with the old password is logged out
  return { password: input.password ? undefined : password };
});

const blockUser = wrap(async (req, caller) => {
  const input = z.object({ userId: UserIdSchema, blocked: z.boolean(), reason: z.string().trim().max(500).optional() }).parse(req.body);
  const target = await loadTarget(caller, input.userId);
  if (input.blocked) {
    await db.update(schema.users).set({ blockedAt: utcNow as unknown as Date, blockedReason: input.reason || null }).where(eq(schema.users.userId, target.userId));
    await endSessions(target.userId);
  } else {
    await db.update(schema.users).set({ blockedAt: null, blockedReason: null }).where(eq(schema.users.userId, target.userId));
  }
});

const deleteUser = wrap(async (req, caller) => {
  const input = z.object({ userId: UserIdSchema }).parse(req.body);
  const target = await loadTarget(caller, input.userId);
  await endSessions(target.userId);
  await db.delete(schema.users).where(eq(schema.users.userId, target.userId));
});

const sendMessage = wrap(async (req, caller) => {
  const input = z.object({
    userIds: z.array(UserIdSchema).max(500).default([]),
    organizationId: OrganizationIdSchema.optional(),
    subject: z.string().trim().min(1).max(150),
    body: z.string().trim().min(1).max(5000),
  }).parse(req.body);
  if (!input.userIds.length && !input.organizationId) throw new HttpError(400, 'Välj minst en mottagare');
  const fromOrg = input.organizationId
    ? await db.select({ userId: schema.organizationMembers.userId }).from(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, input.organizationId))
    : [];
  const recipients = [...new Set([...input.userIds, ...fromOrg.map(m => m.userId)])];
  const existing = recipients.length ? await db.select({ userId: schema.users.userId }).from(schema.users).where(inArray(schema.users.userId, recipients)) : [];
  if (!existing.length) throw new HttpError(400, 'Inga mottagare hittades');
  await db.insert(schema.userMessages).values(existing.map(u => ({
    userId: u.userId, fromUserId: caller.userId, subject: input.subject, body: input.body, createdAt: utcNow as unknown as Date,
  })));
  return { sent: existing.length };
});

export default function createAdminUserRouter() {
  const router = Router();
  router.get('/', isLoggedIn, listUsers);
  router.get('/summary', isLoggedIn, summary);
  router.post('/create', isLoggedIn, createUser);
  router.post('/update', isLoggedIn, updateUser);
  router.post('/password', isLoggedIn, resetPassword);
  router.post('/block', isLoggedIn, blockUser);
  router.post('/delete', isLoggedIn, deleteUser);
  router.post('/message', isLoggedIn, sendMessage);
  // Keep the parameterised route last so it does not shadow the fixed ones above.
  router.get('/:userId', isLoggedIn, getUser);
  return router;
}
