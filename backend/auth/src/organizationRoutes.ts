import { RequestHandler, Router, Request } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from 'database';
import { hasAtLeastSecurityRole, DepartmentIdSchema, OrganizationIdSchema, UnitIdSchema, UserIdSchema, type DepartmentId, type OrganizationId, type UnitId, type UserId } from 'schemas';
import { isLoggedIn } from './utils.js';
import { endSessions } from './adminUserRoutes.js';

/**
 * Organization administration.
 *  - Platform admins (global role superadmin/god) can do everything, in every organization.
 *  - An org_admin can manage their own organization: units, members and users.
 *  - A unit_admin can manage membership of their own unit.
 * The caller's current role and memberships are always re-read from the database,
 * never trusted from the session.
 */

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Caller = { userId: UserId; role: typeof schema.users.$inferSelect['role'] };

async function loadCaller(req: Request): Promise<Caller> {
  const userId = req.session.userId as UserId | undefined;
  if (!userId) throw new HttpError(403, 'Not logged in');
  const [caller] = await db.select({ userId: schema.users.userId, role: schema.users.role })
    .from(schema.users).where(eq(schema.users.userId, userId));
  if (!caller || caller.role === 'guest') throw new HttpError(403, 'Not authorized');
  return caller;
}

export const isPlatformAdmin = (caller: Caller) => hasAtLeastSecurityRole(caller.role, 'superadmin');

async function isOrgAdmin(caller: Caller, organizationId: OrganizationId) {
  const [m] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, caller.userId), eq(schema.organizationMembers.organizationId, organizationId)));
  return m?.role === 'org_admin';
}

async function requirePlatformAdmin(caller: Caller) {
  if (!isPlatformAdmin(caller)) throw new HttpError(403, 'Only platform administrators can do this');
}

export async function requireOrgManager(caller: Caller, organizationId: OrganizationId) {
  if (isPlatformAdmin(caller) || await isOrgAdmin(caller, organizationId)) return;
  throw new HttpError(403, 'Not authorized to manage this organization');
}

async function requireUnitManager(caller: Caller, unitId: UnitId) {
  const [unit] = await db.select({ organizationId: schema.units.organizationId }).from(schema.units).where(eq(schema.units.unitId, unitId));
  if (!unit) throw new HttpError(404, 'Unit not found');
  if (isPlatformAdmin(caller) || await isOrgAdmin(caller, unit.organizationId)) return unit.organizationId;
  const [um] = await db.select({ role: schema.unitMembers.role }).from(schema.unitMembers)
    .where(and(eq(schema.unitMembers.userId, caller.userId), eq(schema.unitMembers.unitId, unitId)));
  if (um?.role === 'unit_admin') return unit.organizationId;
  throw new HttpError(403, 'Not authorized to manage this unit');
}

export function wrap(handler: (req: Request, caller: Caller) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try {
      const caller = await loadCaller(req);
      const result = await handler(req, caller);
      res.send(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) { res.status(e.status).send({ message: e.message }); return; }
      if (e instanceof z.ZodError) { res.status(400).send({ message: 'Invalid input', issues: e.issues.map(i => `${i.path.join('.')}: ${i.message}`) }); return; }
      // Drizzle wraps driver errors; the Postgres error code can be on the error itself or on its cause.
      const pgError = e as { code?: string; cause?: { code?: string } };
      const code = pgError?.code ?? pgError?.cause?.code;
      if (code === '23505') { res.status(409).send({ message: 'Already exists' }); return; }
      if (code === '23503') { res.status(409).send({ message: 'Cannot be removed or changed while other data depends on it' }); return; }
      console.error('organization route error:', e);
      res.status(500).send({ message: 'Internal error' });
    }
  };
}

const nameSchema = z.string().trim().min(1).max(200);
const OrgTypeSchema = z.enum(schema.OrganizationTypeEnum.enumValues);
const OrgRoleSchema = z.enum(schema.OrganizationRoleEnum.enumValues);
const UnitRoleSchema = z.enum(schema.UnitRoleEnum.enumValues);

/* ----------------------------- organizations ----------------------------- */

const logoVersionSql = sql<number | null>`(select l."version" from "OrganizationLogos" l where l."organizationId" = ${schema.organizations.organizationId})`;

const listOrganizations = wrap(async (_req, caller) => {
  if (isPlatformAdmin(caller)) {
    return db.select({
      organizationId: schema.organizations.organizationId,
      name: schema.organizations.name,
      type: schema.organizations.type,
      memberCount: sql<number>`(select count(*)::int from "OrganizationMembers" m where m."organizationId" = ${schema.organizations.organizationId})`,
      unitCount: sql<number>`(select count(*)::int from "Units" u where u."organizationId" = ${schema.organizations.organizationId})`,
      logoVersion: logoVersionSql,
    }).from(schema.organizations).orderBy(asc(schema.organizations.name));
  }
  return db.select({
    organizationId: schema.organizations.organizationId,
    name: schema.organizations.name,
    type: schema.organizations.type,
    myRole: schema.organizationMembers.role,
    logoVersion: logoVersionSql,
  }).from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.organizationId, schema.organizationMembers.organizationId))
    .where(eq(schema.organizationMembers.userId, caller.userId))
    .orderBy(asc(schema.organizations.name));
});

/** The units the caller administers (unit administrator), with their organization. */
const myAdministeredUnits = wrap(async (_req, caller) => {
  return db.select({
    organizationId: schema.organizations.organizationId,
    organizationName: schema.organizations.name,
    unitId: schema.units.unitId,
    unitName: schema.units.name,
  }).from(schema.unitMembers)
    .innerJoin(schema.units, eq(schema.units.unitId, schema.unitMembers.unitId))
    .innerJoin(schema.organizations, eq(schema.organizations.organizationId, schema.unitMembers.organizationId))
    .where(and(eq(schema.unitMembers.userId, caller.userId), eq(schema.unitMembers.role, 'unit_admin')))
    .orderBy(asc(schema.organizations.name), asc(schema.units.name));
});

const getOrganization = wrap(async (req, caller) => {
  const organizationId = OrganizationIdSchema.parse(req.params.organizationId);
  await requireOrgManager(caller, organizationId);
  const [organization] = await db.select().from(schema.organizations).where(eq(schema.organizations.organizationId, organizationId));
  if (!organization) throw new HttpError(404, 'Organization not found');
  const units = await db.select().from(schema.units).where(eq(schema.units.organizationId, organizationId)).orderBy(asc(schema.units.name));
  const members = await db.select({
    userId: schema.users.userId,
    username: schema.users.username,
    role: schema.organizationMembers.role,
  }).from(schema.organizationMembers)
    .innerJoin(schema.users, eq(schema.users.userId, schema.organizationMembers.userId))
    .where(eq(schema.organizationMembers.organizationId, organizationId)).orderBy(asc(schema.users.username));
  const unitMembers = await db.select({
    unitId: schema.unitMembers.unitId,
    userId: schema.unitMembers.userId,
    role: schema.unitMembers.role,
  }).from(schema.unitMembers).where(eq(schema.unitMembers.organizationId, organizationId));
  const [logo] = await db.select({ version: schema.organizationLogos.version }).from(schema.organizationLogos)
    .where(eq(schema.organizationLogos.organizationId, organizationId));
  const departments = await db.select({ departmentId: schema.departments.departmentId, unitId: schema.departments.unitId, name: schema.departments.name })
    .from(schema.departments).where(eq(schema.departments.organizationId, organizationId)).orderBy(asc(schema.departments.name));
  const departmentMembers = departments.length ? await db.select({
    departmentId: schema.departmentMembers.departmentId,
    userId: schema.departmentMembers.userId,
    unitId: schema.departmentMembers.unitId,
  }).from(schema.departmentMembers).where(inArray(schema.departmentMembers.departmentId, departments.map(d => d.departmentId))) : [];
  return { organization: { ...organization, logoVersion: logo?.version ?? null }, units, members, unitMembers, departments, departmentMembers };
});

const LOGO_MAX_BYTES = 300 * 1024;
/** Only formats that cannot carry scripts. SVG is deliberately not allowed. The bytes are checked, not the claimed type. */
function detectImageMime(data: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | undefined {
  if (data.length > 12 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length > 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return undefined;
}

const setOrgLogo = wrap(async (req, caller) => {
  const input = z.object({ organizationId: OrganizationIdSchema, image: z.string().min(1).max(500_000) }).parse(req.body);
  await requireOrgManager(caller, input.organizationId);
  const data = Buffer.from(input.image, 'base64');
  if (!data.length || data.length > LOGO_MAX_BYTES) throw new HttpError(400, 'Loggan får vara högst 300 kB.');
  const mimeType = detectImageMime(data);
  if (!mimeType) throw new HttpError(400, 'Loggan måste vara en PNG-, JPEG- eller WebP-bild.');
  await db.insert(schema.organizationLogos).values({ organizationId: input.organizationId, data, mimeType })
    .onConflictDoUpdate({
      target: schema.organizationLogos.organizationId,
      set: { data, mimeType, version: sql`${schema.organizationLogos.version} + 1` },
    });
});

const removeOrgLogo = wrap(async (req, caller) => {
  const input = z.object({ organizationId: OrganizationIdSchema }).parse(req.body);
  await requireOrgManager(caller, input.organizationId);
  await db.delete(schema.organizationLogos).where(eq(schema.organizationLogos.organizationId, input.organizationId));
});

const createOrganization = wrap(async (req, caller) => {
  await requirePlatformAdmin(caller);
  const input = z.object({ name: nameSchema, type: OrgTypeSchema.default('other') }).parse(req.body);
  const [created] = await db.insert(schema.organizations).values(input).returning();
  return created;
});

const updateOrganization = wrap(async (req, caller) => {
  await requirePlatformAdmin(caller);
  const input = z.object({ organizationId: OrganizationIdSchema, name: nameSchema.optional(), type: OrgTypeSchema.optional() }).parse(req.body);
  const { organizationId, ...changes } = input;
  const [updated] = await db.update(schema.organizations).set(changes).where(eq(schema.organizations.organizationId, organizationId)).returning();
  if (!updated) throw new HttpError(404, 'Organization not found');
  return updated;
});

const deleteOrganization = wrap(async (req, caller) => {
  await requirePlatformAdmin(caller);
  const { organizationId } = z.object({ organizationId: OrganizationIdSchema }).parse(req.body);
  // Resources reference the organization with ON DELETE RESTRICT, so this fails (409) while any exist.
  const deleted = await db.delete(schema.organizations).where(eq(schema.organizations.organizationId, organizationId)).returning({ id: schema.organizations.organizationId });
  if (!deleted.length) throw new HttpError(404, 'Organization not found');
});

/* --------------------------------- units --------------------------------- */

const createUnit = wrap(async (req, caller) => {
  const input = z.object({ organizationId: OrganizationIdSchema, name: nameSchema }).parse(req.body);
  await requireOrgManager(caller, input.organizationId);
  const [created] = await db.insert(schema.units).values(input).returning();
  return created;
});

const deleteUnit = wrap(async (req, caller) => {
  const { unitId } = z.object({ unitId: UnitIdSchema }).parse(req.body);
  const [unit] = await db.select({ organizationId: schema.units.organizationId }).from(schema.units).where(eq(schema.units.unitId, unitId));
  if (!unit) throw new HttpError(404, 'Unit not found');
  await requireOrgManager(caller, unit.organizationId);
  await db.delete(schema.units).where(eq(schema.units.unitId, unitId));
});

/* --------------------------------- members -------------------------------- */

const setMember = wrap(async (req, caller) => {
  const input = z.object({ organizationId: OrganizationIdSchema, userId: UserIdSchema, role: OrgRoleSchema.default('member') }).parse(req.body);
  await requireOrgManager(caller, input.organizationId);
  const [target] = await db.select({ userId: schema.users.userId, role: schema.users.role }).from(schema.users).where(eq(schema.users.userId, input.userId));
  if (!target) throw new HttpError(404, 'User not found');
  // Platform administrators are not tenant members: they already see everything.
  if (hasAtLeastSecurityRole(target.role, 'superadmin')) throw new HttpError(400, 'Platform administrators do not need a membership');
  // An org admin may only change the role of someone who is already a member. Pulling an arbitrary account into
  // the organization would make it "manageable" (password reset / delete), so that is for platform admins;
  // org admins add people through invitations or by creating users.
  if (!isPlatformAdmin(caller)) {
    const [existing] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
      .where(and(eq(schema.organizationMembers.userId, input.userId), eq(schema.organizationMembers.organizationId, input.organizationId)));
    if (!existing) throw new HttpError(403, 'Bara plattformsadministratören kan lägga till befintliga konton. Använd en inbjudan eller skapa användaren.');
  }
  await db.insert(schema.organizationMembers).values(input)
    .onConflictDoUpdate({ target: [schema.organizationMembers.userId, schema.organizationMembers.organizationId], set: { role: input.role } });
});

const removeMember = wrap(async (req, caller) => {
  const input = z.object({ organizationId: OrganizationIdSchema, userId: UserIdSchema }).parse(req.body);
  await requireOrgManager(caller, input.organizationId);
  // Unit memberships follow via ON DELETE CASCADE.
  await db.delete(schema.organizationMembers).where(and(
    eq(schema.organizationMembers.organizationId, input.organizationId),
    eq(schema.organizationMembers.userId, input.userId)));
});

const setUnitMember = wrap(async (req, caller) => {
  const input = z.object({ unitId: UnitIdSchema, userId: UserIdSchema, role: UnitRoleSchema.default('member') }).parse(req.body);
  const organizationId = await requireUnitManager(caller, input.unitId);
  // The composite foreign key rejects users who are not members of the organization (-> 409).
  const [member] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, input.userId), eq(schema.organizationMembers.organizationId, organizationId)));
  if (!member) throw new HttpError(400, 'The user must be a member of the organization first');
  await db.insert(schema.unitMembers).values({ ...input, organizationId })
    .onConflictDoUpdate({ target: [schema.unitMembers.userId, schema.unitMembers.unitId], set: { role: input.role } });
});

/* ------------------------------- departments ------------------------------ */

async function loadDepartment(departmentId: DepartmentId) {
  const [department] = await db.select({ departmentId: schema.departments.departmentId, unitId: schema.departments.unitId, organizationId: schema.departments.organizationId })
    .from(schema.departments).where(eq(schema.departments.departmentId, departmentId));
  if (!department) throw new HttpError(404, 'Avdelningen finns inte');
  return department;
}

const createDepartment = wrap(async (req, caller) => {
  const input = z.object({ unitId: UnitIdSchema, name: nameSchema }).parse(req.body);
  const organizationId = await requireUnitManager(caller, input.unitId);
  const [created] = await db.insert(schema.departments).values({ unitId: input.unitId, organizationId, name: input.name })
    .returning({ departmentId: schema.departments.departmentId, unitId: schema.departments.unitId, name: schema.departments.name });
  return created;
});

const deleteDepartment = wrap(async (req, caller) => {
  const { departmentId } = z.object({ departmentId: DepartmentIdSchema }).parse(req.body);
  const department = await loadDepartment(departmentId);
  await requireUnitManager(caller, department.unitId);
  await db.delete(schema.departments).where(eq(schema.departments.departmentId, departmentId));
});

const setDepartmentMember = wrap(async (req, caller) => {
  const { departmentId, userId } = z.object({ departmentId: DepartmentIdSchema, userId: UserIdSchema }).parse(req.body);
  const department = await loadDepartment(departmentId);
  await requireUnitManager(caller, department.unitId);
  const [orgMember] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, userId), eq(schema.organizationMembers.organizationId, department.organizationId)));
  if (!orgMember) throw new HttpError(400, 'Användaren måste vara medlem i organisationen först');
  await db.transaction(async tx => {
    // being in a department means being in its unit
    await tx.insert(schema.unitMembers).values({ userId, unitId: department.unitId, organizationId: department.organizationId }).onConflictDoNothing();
    await tx.insert(schema.departmentMembers).values({ departmentId, userId, unitId: department.unitId }).onConflictDoNothing();
  });
});

const removeDepartmentMember = wrap(async (req, caller) => {
  const { departmentId, userId } = z.object({ departmentId: DepartmentIdSchema, userId: UserIdSchema }).parse(req.body);
  const department = await loadDepartment(departmentId);
  await requireUnitManager(caller, department.unitId);
  await db.delete(schema.departmentMembers).where(and(eq(schema.departmentMembers.departmentId, departmentId), eq(schema.departmentMembers.userId, userId)));
});

const removeUnitMember = wrap(async (req, caller) => {
  const input = z.object({ unitId: UnitIdSchema, userId: UserIdSchema }).parse(req.body);
  await requireUnitManager(caller, input.unitId);
  await db.delete(schema.unitMembers).where(and(eq(schema.unitMembers.unitId, input.unitId), eq(schema.unitMembers.userId, input.userId)));
});

/** Create a new user inside an organization. The user always gets the plain global role 'user'. */
/**
 * Accounts an organization may manage (reset password, delete): ordinary accounts that are members of the
 * organization. Org admins are limited to plain members whose account belongs to no other organization, so they
 * can never take over or remove an account that someone else depends on. Platform admins may manage any such account.
 */
export async function loadManageableAccount(caller: Caller, organizationId: OrganizationId, userId: UserId) {
  await requireOrgManager(caller, organizationId);
  const [target] = await db.select({ userId: schema.users.userId, role: schema.users.role, username: schema.users.username })
    .from(schema.users).where(eq(schema.users.userId, userId));
  const [membership] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, userId), eq(schema.organizationMembers.organizationId, organizationId)));
  if (!target || !membership) throw new HttpError(404, 'Användaren finns inte i organisationen');
  if (target.userId === caller.userId) throw new HttpError(400, 'Du kan inte ändra ditt eget konto här');
  if (target.role !== 'user') throw new HttpError(403, 'Det här kontot kan bara hanteras av plattformsadministratören');
  if (!isPlatformAdmin(caller)) {
    if (membership.role === 'org_admin') throw new HttpError(403, 'Administratörer kan bara hanteras av plattformsadministratören');
    const [other] = await db.select({ organizationId: schema.organizationMembers.organizationId }).from(schema.organizationMembers)
      .where(and(eq(schema.organizationMembers.userId, userId), sql`${schema.organizationMembers.organizationId} <> ${organizationId}`)).limit(1);
    if (other) throw new HttpError(403, 'Användaren tillhör flera organisationer. Ta bort användaren ur organisationen i stället.');
  }
  return target;
}

const setOrgUserPassword = wrap(async (req, caller) => {
  const input = z.object({
    organizationId: OrganizationIdSchema, userId: UserIdSchema, password: z.string().min(8).max(200),
  }).parse(req.body);
  const target = await loadManageableAccount(caller, input.organizationId, input.userId);
  const password = await bcrypt.hash(input.password, 10);
  await db.update(schema.users).set({ password }).where(eq(schema.users.userId, target.userId));
  await endSessions(target.userId);
});

const deleteOrgUser = wrap(async (req, caller) => {
  const input = z.object({ organizationId: OrganizationIdSchema, userId: UserIdSchema }).parse(req.body);
  const target = await loadManageableAccount(caller, input.organizationId, input.userId);
  await db.delete(schema.users).where(eq(schema.users.userId, target.userId));
});

const IMPORT_MAX_ROWS = 500;

/**
 * Bulk import of users into an organization (from the Excel template).
 * Columns: username, password, role, unit(s), department(s).
 * dryRun=true only validates and reports per row; otherwise every valid row is created in one transaction.
 * With createMissing, units and departments that do not exist yet are created (and the preview says so).
 * Rows with errors are skipped, never half-created.
 */
const importOrgUsers = wrap(async (req, caller) => {
  const input = z.object({
    organizationId: OrganizationIdSchema,
    dryRun: z.boolean().default(false),
    createMissing: z.boolean().default(false),
    rows: z.array(z.object({
      row: z.number().int().min(1).max(1_000_000),
      username: z.string().max(500).default(''),
      password: z.string().max(500).default(''),
      role: z.string().max(100).default(''),
      units: z.string().max(2000).default(''),
      departments: z.string().max(2000).default(''),
    })).min(1).max(IMPORT_MAX_ROWS),
  }).parse(req.body);
  await requireOrgManager(caller, input.organizationId);

  const key = (s: string) => s.trim().toLowerCase();
  const splitNames = (s: string) => [...new Map(s.split(/[;,]/).map(p => p.trim()).filter(Boolean).map(p => [key(p), p])).values()];

  const units = await db.select({ unitId: schema.units.unitId, name: schema.units.name }).from(schema.units)
    .where(eq(schema.units.organizationId, input.organizationId));
  const unitByName = new Map(units.map(u => [key(u.name), u.unitId]));
  const existingDepartments = await db.select({ departmentId: schema.departments.departmentId, unitId: schema.departments.unitId, name: schema.departments.name })
    .from(schema.departments).where(eq(schema.departments.organizationId, input.organizationId));
  // unit id -> (department name -> department id)
  const departmentsByUnit = new Map<string, Map<string, string>>();
  for (const d of existingDepartments) {
    if (!departmentsByUnit.has(d.unitId)) departmentsByUnit.set(d.unitId, new Map());
    departmentsByUnit.get(d.unitId)!.set(key(d.name), d.departmentId);
  }

  const usernames = input.rows.map(r => r.username.trim()).filter(Boolean);
  const existing = usernames.length
    ? await db.select({ username: schema.users.username }).from(schema.users).where(inArray(schema.users.username, usernames))
    : [];
  const existingSet = new Set(existing.map(u => u.username.toLowerCase()));

  // Things this import would create. A unit/department is referenced by a "ref": an existing id or "new:<key>".
  const newUnits = new Map<string, string>(); // key -> display name
  const newDepartments = new Map<string, { unitRef: string; name: string }>(); // "unitRef|key" -> ...

  type Result = { row: number; username: string; status: 'ok' | 'error'; message?: string };
  type Plan = { username: string; password: string; role: 'member' | 'org_admin' | 'basic'; unitRefs: string[]; departmentRefs: string[] };
  const results: Result[] = [];
  const valid: Plan[] = [];
  const seen = new Set<string>();
  const pendingNew = { units: new Map<string, string>(), departments: new Map<string, { unitRef: string; name: string }>() };

  input.rows.forEach(r => {
    const username = r.username.trim();
    const fail = (message: string) => results.push({ row: r.row, username, status: 'error', message });
    if (username.length < 2 || username.length > 100) return fail('Användarnamn måste vara 2–100 tecken.');
    if (r.password.length < 8 || r.password.length > 200) return fail('Lösenord måste vara minst 8 tecken.');
    const userKey = username.toLowerCase();
    if (seen.has(userKey)) return fail('Användarnamnet förekommer flera gånger i filen.');
    if (existingSet.has(userKey)) { seen.add(userKey); return fail('Användarnamnet finns redan.'); }
    const roleText = r.role.trim().toLowerCase();
    let role: 'member' | 'org_admin' | 'basic';
    if (['', 'medlem', 'member'].includes(roleText)) role = 'member';
    else if (['användare', 'anvandare', 'basic'].includes(roleText)) role = 'basic';
    else if (['administratör', 'administrator', 'admin', 'org_admin'].includes(roleText)) role = 'org_admin';
    else return fail('Okänd roll. Använd Användare, Medlem eller Administratör.');

    const unitNames = splitNames(r.units);
    const departmentNames = splitNames(r.departments);
    if (departmentNames.length && !unitNames.length) return fail('Ange vilken enhet avdelningen hör till.');

    const created: string[] = [];
    const rowNewUnits = new Map<string, string>();
    const rowNewDepartments = new Map<string, { unitRef: string; name: string }>();
    const unitRefs: string[] = [];
    for (const name of unitNames) {
      const id = unitByName.get(key(name));
      if (id) { unitRefs.push(id); continue; }
      if (!input.createMissing) return fail(`Enheten "${name}" finns inte i organisationen.`);
      unitRefs.push(`new:${key(name)}`);
      if (!newUnits.has(key(name))) { rowNewUnits.set(key(name), name); created.push(`enheten ${name}`); }
    }
    const departmentRefs: string[] = [];
    for (const name of departmentNames) {
      const found = unitRefs.filter(ref => departmentsByUnit.get(ref)?.has(key(name)) || newDepartments.has(`${ref}|${key(name)}`));
      if (found.length > 1) return fail(`Avdelningen "${name}" finns i flera av enheterna. Ange bara en enhet på raden.`);
      if (found.length === 1) {
        const ref = found[0];
        const existingId = departmentsByUnit.get(ref)?.get(key(name));
        departmentRefs.push(existingId ?? `newdep:${ref}|${key(name)}`);
        continue;
      }
      if (!input.createMissing) {
        return fail(`Avdelningen "${name}" finns inte i ${unitRefs.length === 1 ? 'enheten' : 'de angivna enheterna'}.`);
      }
      if (unitRefs.length !== 1) return fail(`Avdelningen "${name}" kan bara skapas när raden har exakt en enhet.`);
      const ref = unitRefs[0];
      rowNewDepartments.set(`${ref}|${key(name)}`, { unitRef: ref, name });
      departmentRefs.push(`newdep:${ref}|${key(name)}`);
      created.push(`avdelningen ${name}`);
    }

    seen.add(userKey);
    for (const [k, v] of rowNewUnits) { newUnits.set(k, v); pendingNew.units.set(k, v); }
    for (const [k, v] of rowNewDepartments) { newDepartments.set(k, v); pendingNew.departments.set(k, v); }
    valid.push({ username, password: r.password, role, unitRefs, departmentRefs });
    results.push({ row: r.row, username, status: 'ok', message: created.length ? `Skapar ${created.join(' och ')}.` : undefined });
  });
  results.sort((a, b) => a.row - b.row);

  if (input.dryRun || valid.length === 0) {
    return { dryRun: input.dryRun, created: 0, results, newUnits: [...newUnits.values()], newDepartments: [...newDepartments.values()].map(d => d.name) };
  }

  const hashes = await Promise.all(valid.map(v => bcrypt.hash(v.password, 10)));
  await db.transaction(async tx => {
    const unitIdByRef = new Map<string, UnitId>(units.map(u => [u.unitId, u.unitId]));
    for (const [k, name] of newUnits) {
      const [u] = await tx.insert(schema.units).values({ organizationId: input.organizationId, name }).returning({ unitId: schema.units.unitId });
      unitIdByRef.set(`new:${k}`, u.unitId);
    }
    const departmentIdByRef = new Map<string, DepartmentId>();
    for (const d of existingDepartments) departmentIdByRef.set(d.departmentId, d.departmentId);
    for (const [k, d] of newDepartments) {
      const [created] = await tx.insert(schema.departments)
        .values({ unitId: unitIdByRef.get(d.unitRef)!, organizationId: input.organizationId, name: d.name })
        .returning({ departmentId: schema.departments.departmentId });
      departmentIdByRef.set(`newdep:${k}`, created.departmentId);
    }

    const inserted = await tx.insert(schema.users)
      .values(valid.map((v, i) => ({ username: v.username, password: hashes[i], role: 'user' as const })))
      .returning({ userId: schema.users.userId, username: schema.users.username });
    const idByName = new Map(inserted.map(u => [u.username, u.userId]));
    await tx.insert(schema.organizationMembers)
      .values(valid.map(v => ({ userId: idByName.get(v.username)!, organizationId: input.organizationId, role: v.role })));
    const unitRows = valid.flatMap(v => [...new Set(v.unitRefs)].map(ref => ({ userId: idByName.get(v.username)!, unitId: unitIdByRef.get(ref)!, organizationId: input.organizationId })));
    if (unitRows.length) await tx.insert(schema.unitMembers).values(unitRows);
    // a department is always inside one of the row's units, so the person is already in that unit
    const departmentRows = valid.flatMap(v => [...new Set(v.departmentRefs)].map(ref => {
      const departmentId = departmentIdByRef.get(ref)!;
      const unitId = ref.startsWith('newdep:') ? unitIdByRef.get(newDepartments.get(ref.slice(7))!.unitRef)! : existingDepartments.find(d => d.departmentId === ref)!.unitId;
      return { departmentId, userId: idByName.get(v.username)!, unitId };
    }));
    if (departmentRows.length) await tx.insert(schema.departmentMembers).values(departmentRows);
  });
  return { dryRun: false, created: valid.length, results, newUnits: [...newUnits.values()], newDepartments: [...newDepartments.values()].map(d => d.name) };
});

const createOrgUser = wrap(async (req, caller) => {
  const input = z.object({
    organizationId: OrganizationIdSchema,
    username: z.string().trim().min(2).max(100),
    password: z.string().min(8).max(200),
    role: OrgRoleSchema.default('member'),
    unitIds: z.array(UnitIdSchema).max(100).default([]),
    departmentIds: z.array(DepartmentIdSchema).max(100).default([]),
  }).parse(req.body);
  await requireOrgManager(caller, input.organizationId);
  // Departments must belong to this organization. Being in a department means being in its unit.
  const wantedDepartments = [...new Set(input.departmentIds)];
  const departmentRows = wantedDepartments.length
    ? await db.select({ departmentId: schema.departments.departmentId, unitId: schema.departments.unitId }).from(schema.departments)
      .where(and(eq(schema.departments.organizationId, input.organizationId), inArray(schema.departments.departmentId, wantedDepartments)))
    : [];
  if (departmentRows.length !== wantedDepartments.length) throw new HttpError(400, 'En avdelning hör inte till organisationen');
  const allUnitIds = [...new Set([...input.unitIds, ...departmentRows.map(d => d.unitId)])];
  if (input.unitIds.length) {
    const found = await db.select({ unitId: schema.units.unitId }).from(schema.units)
      .where(and(eq(schema.units.organizationId, input.organizationId), inArray(schema.units.unitId, input.unitIds)));
    if (found.length !== new Set(input.unitIds).size) throw new HttpError(400, 'A unit does not belong to this organization');
  }
  const password = await bcrypt.hash(input.password, 10);
  return db.transaction(async tx => {
    const [user] = await tx.insert(schema.users).values({ username: input.username, password, role: 'user' })
      .returning({ userId: schema.users.userId, username: schema.users.username });
    await tx.insert(schema.organizationMembers).values({ userId: user.userId, organizationId: input.organizationId, role: input.role });
    if (allUnitIds.length) {
      await tx.insert(schema.unitMembers).values(allUnitIds.map(unitId => ({ userId: user.userId, unitId, organizationId: input.organizationId })));
    }
    if (departmentRows.length) {
      await tx.insert(schema.departmentMembers).values(departmentRows.map(d => ({ departmentId: d.departmentId, userId: user.userId, unitId: d.unitId })));
    }
    return user;
  });
});

/** Organizations and units the caller may put their own resources into. */
const listAssignable = wrap(async (_req, caller) => {
  const orgs = isPlatformAdmin(caller)
    ? await db.select({ organizationId: schema.organizations.organizationId, name: schema.organizations.name, myRole: sql<string | null>`null` }).from(schema.organizations)
    : await db.select({ organizationId: schema.organizations.organizationId, name: schema.organizations.name, myRole: schema.organizationMembers.role })
      .from(schema.organizationMembers)
      .innerJoin(schema.organizations, eq(schema.organizations.organizationId, schema.organizationMembers.organizationId))
      .where(eq(schema.organizationMembers.userId, caller.userId));
  if (!orgs.length) return [];
  const units = await db.select({ unitId: schema.units.unitId, organizationId: schema.units.organizationId, name: schema.units.name })
    .from(schema.units).where(inArray(schema.units.organizationId, orgs.map(o => o.organizationId))).orderBy(asc(schema.units.name));
  const myUnits = isPlatformAdmin(caller) ? [] : await db.select({ unitId: schema.unitMembers.unitId }).from(schema.unitMembers)
    .where(eq(schema.unitMembers.userId, caller.userId));
  const mine = new Set(myUnits.map(u => u.unitId));
  return orgs.sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(o => ({
    organizationId: o.organizationId,
    name: o.name,
    // admins can use every unit; members only the units they belong to
    units: units.filter(u => u.organizationId === o.organizationId && (isPlatformAdmin(caller) || o.myRole === 'org_admin' || mine.has(u.unitId)))
      .map(u => ({ unitId: u.unitId, name: u.name })),
  }));
});

/* ------------------------- move a resource into scope ------------------------- */

const assignResource = wrap(async (req, caller) => {
  const input = z.object({
    type: z.enum(['vrSpace', 'stream', 'asset']),
    id: z.string().uuid(),
    organizationId: OrganizationIdSchema.nullable(),
    unitId: UnitIdSchema.nullable().default(null),
  }).parse(req.body);
  if (input.unitId && !input.organizationId) throw new HttpError(400, 'A unit requires an organization');

  // One small accessor per resource type keeps the three table types apart for the compiler.
  const scoped = {
    vrSpace: {
      read: async () => (await db.select({ ownerUserId: schema.vrSpaces.ownerUserId, organizationId: schema.vrSpaces.organizationId }).from(schema.vrSpaces).where(eq(schema.vrSpaces.vrSpaceId, input.id as never)))[0],
      write: (organizationId: OrganizationId | null, unitId: UnitId | null) => db.update(schema.vrSpaces).set({ organizationId, unitId }).where(eq(schema.vrSpaces.vrSpaceId, input.id as never)),
    },
    stream: {
      read: async () => (await db.select({ ownerUserId: schema.streams.ownerUserId, organizationId: schema.streams.organizationId }).from(schema.streams).where(eq(schema.streams.streamId, input.id as never)))[0],
      write: (organizationId: OrganizationId | null, unitId: UnitId | null) => db.update(schema.streams).set({ organizationId, unitId }).where(eq(schema.streams.streamId, input.id as never)),
    },
    asset: {
      read: async () => (await db.select({ ownerUserId: schema.assets.ownerUserId, organizationId: schema.assets.organizationId }).from(schema.assets).where(eq(schema.assets.assetId, input.id as never)))[0],
      write: (organizationId: OrganizationId | null, unitId: UnitId | null) => db.update(schema.assets).set({ organizationId, unitId }).where(eq(schema.assets.assetId, input.id as never)),
    },
  }[input.type];
  const current = await scoped.read();
  if (!current) throw new HttpError(404, 'Resource not found');

  // Taking a resource out of an organization, or moving it between organizations, is a platform decision.
  if (current.organizationId && current.organizationId !== input.organizationId) await requirePlatformAdmin(caller);
  // Someone else's personal resource can only be moved by its owner (or a platform admin), never by an org admin.
  if (!current.organizationId && current.ownerUserId !== caller.userId && !isPlatformAdmin(caller)) {
    throw new HttpError(403, 'Only the owner can move this resource into an organization');
  }
  if (input.organizationId) {
    // Who may put this resource into the organization/unit:
    //  - platform admins and the organization's admins, for anything
    //  - the OWNER of a personal resource, but only into an organization they belong to,
    //    and only into a unit they belong to
    const manager = isPlatformAdmin(caller) || await isOrgAdmin(caller, input.organizationId);
    if (!manager) {
      const ownsPersonal = !current.organizationId && current.ownerUserId === caller.userId;
      const [om] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
        .where(and(eq(schema.organizationMembers.userId, caller.userId), eq(schema.organizationMembers.organizationId, input.organizationId)));
      let allowed = ownsPersonal && !!om;
      if (allowed && input.unitId) {
        const [um] = await db.select({ role: schema.unitMembers.role }).from(schema.unitMembers)
          .where(and(eq(schema.unitMembers.userId, caller.userId), eq(schema.unitMembers.unitId, input.unitId)));
        allowed = !!um;
      }
      if (!allowed) throw new HttpError(403, 'Not authorized to move this resource there');
    }
  } else if (!isPlatformAdmin(caller)) {
    throw new HttpError(403, 'Only platform administrators can make an organization resource personal');
  }
  if (input.unitId && input.organizationId) {
    const [unit] = await db.select({ id: schema.units.unitId }).from(schema.units)
      .where(and(eq(schema.units.unitId, input.unitId), eq(schema.units.organizationId, input.organizationId)));
    if (!unit) throw new HttpError(400, 'The unit does not belong to that organization');
  }
  // (A resource that goes back to being personal with visibility 'organization'/'unit' is simply unreachable
  // for everyone but its owner, because the access check fails closed.)
  await scoped.write(input.organizationId, input.unitId);
});

export default function createOrganizationRouter(): Router {
  const router = Router();
  router.get('/list', isLoggedIn, listOrganizations);
  router.get('/assignable', isLoggedIn, listAssignable);
  router.post('/create', isLoggedIn, createOrganization);
  router.post('/update', isLoggedIn, updateOrganization);
  router.post('/delete', isLoggedIn, deleteOrganization);
  router.post('/unit/create', isLoggedIn, createUnit);
  router.post('/unit/delete', isLoggedIn, deleteUnit);
  router.post('/unit/member/set', isLoggedIn, setUnitMember);
  router.post('/unit/member/remove', isLoggedIn, removeUnitMember);
  router.post('/department/create', isLoggedIn, createDepartment);
  router.post('/department/delete', isLoggedIn, deleteDepartment);
  router.post('/department/member/set', isLoggedIn, setDepartmentMember);
  router.post('/department/member/remove', isLoggedIn, removeDepartmentMember);
  router.post('/member/set', isLoggedIn, setMember);
  router.post('/member/remove', isLoggedIn, removeMember);
  router.post('/user/create', isLoggedIn, createOrgUser);
  router.post('/user/import', isLoggedIn, importOrgUsers);
  router.post('/logo', isLoggedIn, setOrgLogo);
  router.post('/logo/remove', isLoggedIn, removeOrgLogo);
  router.post('/user/password', isLoggedIn, setOrgUserPassword);
  router.post('/user/delete', isLoggedIn, deleteOrgUser);
  router.post('/resource/assign', isLoggedIn, assignResource);
  router.get('/my-units', isLoggedIn, myAdministeredUnits);
  // Keep the parameterised route last so it does not shadow the fixed ones above.
  router.get('/:organizationId', isLoggedIn, getOrganization);
  return router;
}
