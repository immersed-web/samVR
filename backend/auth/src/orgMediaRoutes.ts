import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { db, schema } from 'database';
import { OrganizationIdSchema, UnitIdSchema } from 'schemas';
import { isLoggedIn } from './utils.js';
import { HttpError, isPlatformAdmin, requireOrgManager, wrap, type Caller } from './organizationRoutes.js';
import type { OrganizationId } from 'schemas';

/**
 * The media library of ONE organization, for its administrators.
 * A file belongs to an organization when its uploader had exactly one organization at upload time
 * (and to a unit when the uploader had exactly one unit there). Deleting is done through the file server,
 * which allows an administrator to delete files of their own organization only.
 * Only files meant for the library are listed (showInUserLibrary), never navigation meshes.
 * Organization administrators (and platform administrators) see the whole library and may move files.
 * A unit administrator sees the library of the unit(s) they administer, and nothing else (read only).
 */

type Scope = { all: true } | { all: false; unitIds: string[] };

/** What part of the library the caller may see. Throws 403 for everyone else. */
async function mediaScope(caller: Caller, organizationId: OrganizationId): Promise<Scope> {
  if (isPlatformAdmin(caller)) return { all: true };
  const [membership] = await db.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, caller.userId), eq(schema.organizationMembers.organizationId, organizationId)));
  if (membership?.role === 'org_admin') return { all: true };
  const units = membership ? await db.select({ unitId: schema.unitMembers.unitId }).from(schema.unitMembers)
    .where(and(eq(schema.unitMembers.userId, caller.userId), eq(schema.unitMembers.organizationId, organizationId), eq(schema.unitMembers.role, 'unit_admin'))) : [];
  if (!units.length) throw new HttpError(403, 'Not authorized to see this media library');
  return { all: false, unitIds: units.map(u => u.unitId) };
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m);
const LIBRARY_TYPES = ['image', 'video', 'model', 'document'] as const;

export default function createOrgMediaRouter() {
  const router = Router({ mergeParams: true });

  router.get('/', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = OrganizationIdSchema.parse(req.params.organizationId);
    const scope = await mediaScope(caller, organizationId);
    const q = z.object({
      unit: z.union([z.literal('none'), UnitIdSchema]).optional(),
      type: z.enum(LIBRARY_TYPES).optional(),
      search: z.string().trim().max(100).default(''),
      offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(48),
    }).parse(req.query);

    // A unit administrator may only ask for their own unit(s); without a unit they get all of theirs
    if (!scope.all && q.unit && (q.unit === 'none' || !scope.unitIds.includes(q.unit))) throw new HttpError(403, 'Not authorized to see that unit');
    const conditions: (SQL | undefined)[] = [
      eq(schema.assets.organizationId, organizationId),
      scope.all ? undefined : inArray(schema.assets.unitId, scope.unitIds as never[]),
      eq(schema.assets.showInUserLibrary, true),
      ne(schema.assets.assetType, 'navmesh'),
      q.type ? eq(schema.assets.assetType, q.type) : undefined,
      q.search ? ilike(schema.assets.originalFileName, `%${likeEscape(q.search)}%`) : undefined,
      q.unit === 'none' ? isNull(schema.assets.unitId) : q.unit ? eq(schema.assets.unitId, q.unit) : undefined,
    ];
    const where = and(...conditions);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.assets).where(where);
    const rows = await db.select({
      assetId: schema.assets.assetId,
      assetType: schema.assets.assetType,
      originalFileName: schema.assets.originalFileName,
      generatedName: schema.assets.generatedName,
      assetFileExtension: schema.assets.assetFileExtension,
      size: schema.assets.size,
      mimeType: schema.assets.mimeType,
      createdAt: schema.assets.createdAt,
      unitId: schema.assets.unitId,
      unitName: schema.units.name,
      uploader: schema.users.username,
      // how many places use the file: placed in a VR space, or used as its model / navmesh / preview
      usedIn: sql<number>`(
        (select count(*)::int from "PlacedObjects" p where p."type" = 'asset' and p."objectId" = "Assets"."assetId")
        + (select count(*)::int from "VrSpaces" s where s."worldModelAssetId" = "Assets"."assetId" or s."navMeshAssetId" = "Assets"."assetId" or s."panoramicPreview" = "Assets"."assetId")
      )`,
    }).from(schema.assets)
      .leftJoin(schema.units, eq(schema.units.unitId, schema.assets.unitId))
      .leftJoin(schema.users, eq(schema.users.userId, schema.assets.ownerUserId))
      .where(where)
      .orderBy(desc(schema.assets.createdAt), asc(schema.assets.assetId))
      .limit(q.limit).offset(q.offset);
    return { total, assets: rows };
  }));

  router.get('/summary', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = OrganizationIdSchema.parse(req.params.organizationId);
    const scope = await mediaScope(caller, organizationId);
    const rows = await db.select({
      unitId: schema.assets.unitId,
      assetType: schema.assets.assetType,
      count: sql<number>`count(*)::int`,
      bytes: sql<number>`coalesce(sum(${schema.assets.size}), 0)::float8`,
    }).from(schema.assets)
      .where(and(
        eq(schema.assets.organizationId, organizationId), eq(schema.assets.showInUserLibrary, true), ne(schema.assets.assetType, 'navmesh'),
        scope.all ? undefined : inArray(schema.assets.unitId, scope.unitIds as never[]),
      ))
      .groupBy(schema.assets.unitId, schema.assets.assetType);
    const byUnit = new Map<string | null, { unitId: string | null, total: number, bytes: number, image: number, video: number, model: number, document: number }>();
    for (const r of rows) {
      const key = r.unitId ?? null;
      const entry = byUnit.get(key) ?? { unitId: key, total: 0, bytes: 0, image: 0, video: 0, model: 0, document: 0 };
      if (r.assetType !== 'navmesh') entry[r.assetType] += r.count;
      entry.total += r.count; entry.bytes += r.bytes;
      byUnit.set(key, entry);
    }
    const units = [...byUnit.values()];
    return { total: units.reduce((a, u) => a + u.total, 0), bytes: units.reduce((a, u) => a + u.bytes, 0), byUnit: units };
  }));

  /** Move a file to another unit of the organization, or to "no unit" (null). */
  router.post('/move', isLoggedIn, wrap(async (req, caller) => {
    const organizationId = OrganizationIdSchema.parse(req.params.organizationId);
    await requireOrgManager(caller, organizationId);
    const input = z.object({ assetId: z.string().uuid(), unitId: UnitIdSchema.nullable() }).parse(req.body);
    const [asset] = await db.select({ assetId: schema.assets.assetId }).from(schema.assets)
      .where(and(eq(schema.assets.assetId, input.assetId as never), eq(schema.assets.organizationId, organizationId)));
    if (!asset) throw new HttpError(404, 'Filen finns inte i organisationens bibliotek');
    if (input.unitId) {
      const [unit] = await db.select({ unitId: schema.units.unitId }).from(schema.units)
        .where(and(eq(schema.units.unitId, input.unitId), eq(schema.units.organizationId, organizationId)));
      if (!unit) throw new HttpError(400, 'Enheten hör inte till organisationen');
    }
    await db.update(schema.assets).set({ unitId: input.unitId }).where(eq(schema.assets.assetId, asset.assetId));
  }));

  return router;
}
