import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from 'database';
import { OrganizationIdSchema, UserIdSchema, type OrganizationId, type UserId } from 'schemas';
import { isLoggedIn } from './utils.js';
import { HttpError, isPlatformAdmin, loadManageableAccount, requireOrgManager, wrap } from './organizationRoutes.js';
import { endSessions, generatePassword } from './adminUserRoutes.js';

/**
 * "Hantera användare" for an organization's own administrators.
 * Everything here is scoped to ONE organization (the :organizationId in the path). The caller must be an
 * administrator of it (or a platform administrator), re-checked in the database on every request.
 * Changing an account (password, block, delete) follows the same rules as the Medlemmar tab: only plain
 * members whose account belongs to no other organization, never administrators or yourself,
 * unless a platform administrator does it. Messaging any member of the organization is always allowed.
 */

const utcNow = sql`(now() at time zone 'utc')`;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m);
const orgParam = (params: Record<string, string>) => OrganizationIdSchema.parse(params.organizationId);

/** Why this account cannot be changed by the caller, or null when it can. Mirrors loadManageableAccount. */
function manageReason(args: { callerIsPlatformAdmin: boolean; callerId: string; userId: string; globalRole: string; orgRole: string; otherOrganizations: number }) {
  if (args.userId === args.callerId) return 'Det här är ditt eget konto';
  if (args.globalRole !== 'user') return 'Kontot kan bara hanteras av plattformsadministratören';
  if (args.callerIsPlatformAdmin) return null;
  if (args.orgRole === 'org_admin') return 'Administratörer kan bara hanteras av plattformsadministratören';
  if (args.otherOrganizations > 0) return 'Personen tillhör flera organisationer. Du kan ta bort personen ur din organisation i stället.';
  return null;
}

export default function createOrgUserRouter() {
  const router = Router({ mergeParams: true });

  router.get('/', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = orgParam(req.params);
    await requireOrgManager(caller, organizationId);
    const q = z.object({
      search: z.string().trim().max(100).default(''),
      role: z.enum(schema.OrganizationRoleEnum.enumValues).optional(),
      status: z.enum(['all', 'active', 'blocked']).default('all'),
      sort: z.enum(['username', 'createdAt', 'lastLoginAt', 'role']).default('username'),
      order: z.enum(['asc', 'desc']).default('asc'),
      offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }).parse(req.query);

    const conditions: (SQL | undefined)[] = [eq(schema.organizationMembers.organizationId, organizationId)];
    if (q.search) {
      const p = `%${likeEscape(q.search)}%`;
      conditions.push(or(
        ilike(schema.users.username, p),
        sql`exists (select 1 from "UnitMembers" um join "Units" un on un."unitId" = um."unitId" where um."userId" = "Users"."userId" and um."organizationId" = ${organizationId} and un.name ilike ${p})`,
        sql`exists (select 1 from "DepartmentMembers" dm join "Departments" d on d."departmentId" = dm."departmentId" where dm."userId" = "Users"."userId" and d."organizationId" = ${organizationId} and d.name ilike ${p})`,
      ));
    }
    if (q.role) conditions.push(eq(schema.organizationMembers.role, q.role));
    if (q.status === 'blocked') conditions.push(isNotNull(schema.users.blockedAt));
    if (q.status === 'active') conditions.push(isNull(schema.users.blockedAt));
    const where = and(...conditions);

    const direction = q.order === 'desc' ? desc : asc;
    const orderColumn = q.sort === 'role' ? sql`array_position(enum_range(null::"OrganizationRole"), ${schema.organizationMembers.role})`
      : q.sort === 'username' ? schema.users.username : schema.users[q.sort];
    const base = db.select({ total: sql<number>`count(*)::int` }).from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.users.userId, schema.organizationMembers.userId)).where(where);
    const [{ total }] = await base;
    const rows = await db.select({
      userId: schema.users.userId,
      username: schema.users.username,
      globalRole: schema.users.role,
      orgRole: schema.organizationMembers.role,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt,
      blockedAt: schema.users.blockedAt,
      otherOrganizations: sql<number>`(select count(*)::int from "OrganizationMembers" o where o."userId" = "Users"."userId" and o."organizationId" <> ${organizationId})`,
    }).from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.users.userId, schema.organizationMembers.userId))
      .where(where).orderBy(direction(orderColumn), asc(schema.users.username)).limit(q.limit).offset(q.offset);

    const ids = rows.map(r => r.userId);
    const units = ids.length ? await db.select({ userId: schema.unitMembers.userId, name: schema.units.name }).from(schema.unitMembers)
      .innerJoin(schema.units, eq(schema.units.unitId, schema.unitMembers.unitId))
      .where(and(eq(schema.unitMembers.organizationId, organizationId), inArray(schema.unitMembers.userId, ids))).orderBy(asc(schema.units.name)) : [];
    const departments = ids.length ? await db.select({ userId: schema.departmentMembers.userId, name: schema.departments.name }).from(schema.departmentMembers)
      .innerJoin(schema.departments, eq(schema.departments.departmentId, schema.departmentMembers.departmentId))
      .where(and(eq(schema.departments.organizationId, organizationId), inArray(schema.departmentMembers.userId, ids))).orderBy(asc(schema.departments.name)) : [];
    const callerIsPlatformAdmin = isPlatformAdmin(caller);
    return {
      total,
      users: rows.map(({ globalRole, otherOrganizations, ...r }) => ({
        ...r,
        units: units.filter(u => u.userId === r.userId).map(u => u.name),
        departments: departments.filter(d => d.userId === r.userId).map(d => d.name),
        manageReason: manageReason({ callerIsPlatformAdmin, callerId: caller.userId, userId: r.userId, globalRole, orgRole: r.orgRole, otherOrganizations }),
      })),
    };
  }));

  router.get('/summary', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = orgParam(req.params);
    await requireOrgManager(caller, organizationId);
    const [counts] = await db.select({
      total: sql<number>`count(*)::int`,
      blocked: sql<number>`(count(*) filter (where ${schema.users.blockedAt} is not null))::int`,
      neverLoggedIn: sql<number>`(count(*) filter (where ${schema.users.lastLoginAt} is null))::int`,
    }).from(schema.organizationMembers).innerJoin(schema.users, eq(schema.users.userId, schema.organizationMembers.userId))
      .where(eq(schema.organizationMembers.organizationId, organizationId));
    const byRole = await db.select({ role: schema.organizationMembers.role, count: sql<number>`count(*)::int` }).from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.organizationId, organizationId)).groupBy(schema.organizationMembers.role);
    return { ...counts, byRole };
  }));

  router.post('/password', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = orgParam(req.params);
    const input = z.object({ userId: UserIdSchema, password: z.string().min(8).max(200).optional() }).parse(req.body);
    const target = await loadManageableAccount(caller, organizationId, input.userId);
    const password = input.password ?? generatePassword();
    await db.update(schema.users).set({ password: await bcrypt.hash(password, 10) }).where(eq(schema.users.userId, target.userId));
    await endSessions(target.userId);
    return { password: input.password ? undefined : password };
  }));

  router.post('/block', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = orgParam(req.params);
    const input = z.object({ userId: UserIdSchema, blocked: z.boolean(), reason: z.string().trim().max(500).optional() }).parse(req.body);
    const target = await loadManageableAccount(caller, organizationId, input.userId);
    if (input.blocked) {
      await db.update(schema.users).set({ blockedAt: utcNow as unknown as Date, blockedReason: input.reason || null }).where(eq(schema.users.userId, target.userId));
      await endSessions(target.userId);
    } else {
      await db.update(schema.users).set({ blockedAt: null, blockedReason: null }).where(eq(schema.users.userId, target.userId));
    }
  }));

  router.post('/delete', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = orgParam(req.params);
    const { userId } = z.object({ userId: UserIdSchema }).parse(req.body);
    const target = await loadManageableAccount(caller, organizationId, userId);
    await endSessions(target.userId);
    await db.delete(schema.users).where(eq(schema.users.userId, target.userId));
  }));

  /** A message to chosen members, or to everyone in the organization. Recipients outside it are ignored. */
  router.post('/message', isLoggedIn, wrap(async (req, caller) => {
    const organizationId: OrganizationId = orgParam(req.params);
    await requireOrgManager(caller, organizationId);
    const input = z.object({
      userIds: z.array(UserIdSchema).max(500).default([]),
      everyone: z.boolean().default(false),
      subject: z.string().trim().min(1).max(150),
      body: z.string().trim().min(1).max(5000),
    }).parse(req.body);
    if (!input.everyone && !input.userIds.length) throw new HttpError(400, 'Välj minst en mottagare');
    const recipients = await db.select({ userId: schema.organizationMembers.userId }).from(schema.organizationMembers)
      .where(and(
        eq(schema.organizationMembers.organizationId, organizationId),
        input.everyone ? undefined : inArray(schema.organizationMembers.userId, input.userIds as UserId[]),
      ));
    if (!recipients.length) throw new HttpError(400, 'Inga mottagare hittades i organisationen');
    await db.insert(schema.userMessages).values(recipients.map(r => ({
      userId: r.userId, fromUserId: caller.userId, subject: input.subject, body: input.body, createdAt: utcNow as unknown as Date,
    })));
    return { sent: recipients.length };
  }));

  return router;
}
