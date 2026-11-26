import { Router, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from 'database';
import { createJwt } from 'shared-modules/jwtUtils';
import { OrganizationIdSchema, UserIdSchema, VrSpaceIdSchema } from 'schemas';
import { rateLimit } from './onboardingRoutes.js';

/**
 * Public guest gallery. Nothing here needs a login.
 * A VR space only shows up when its owner/admin has opted in (listedInGallery) AND it is open
 * to guests (visibility public or unlisted). Only the space name and description are exposed:
 * never owner names or any other personal data.
 */

const guestVisible = and(
  eq(schema.vrSpaces.listedInGallery, true),
  inArray(schema.vrSpaces.visibility, ['public', 'unlisted']),
);

const PAGE_SIZE_MAX = 48;

const handle = (fn: RequestHandler): RequestHandler => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    if (e instanceof z.ZodError) { res.status(400).send({ message: 'Invalid input' }); return; }
    console.error('gallery route error:', e);
    res.status(500).send({ message: 'Internal error' });
  }
};

export default function createGalleryRouter() {
  const router = Router();
  const readLimit = rateLimit('gallery-read', 300, 10 * 60 * 1000);

  // Organization tiles: every organization that has at least one space in the gallery.
  // ?kind=municipality -> municipalities, ?kind=company -> companies and other organizations, no kind -> all.
  router.get('/organizations', readLimit, handle(async (req, res) => {
    const { kind } = z.object({ kind: z.enum(['municipality', 'company']).optional() }).parse(req.query);
    const kindFilter = kind === 'municipality' ? eq(schema.organizations.type, 'municipality')
      : kind === 'company' ? inArray(schema.organizations.type, ['company', 'other']) : undefined;
    const rows = await db.select({
      organizationId: schema.organizations.organizationId,
      name: schema.organizations.name,
      type: schema.organizations.type,
      spaceCount: sql<number>`count(${schema.vrSpaces.vrSpaceId})::int`,
      logoVersion: sql<number | null>`(select l."version" from "OrganizationLogos" l where l."organizationId" = ${schema.organizations.organizationId})`,
    }).from(schema.organizations)
      .innerJoin(schema.vrSpaces, eq(schema.vrSpaces.organizationId, schema.organizations.organizationId))
      .where(and(guestVisible, kindFilter))
      .groupBy(schema.organizations.organizationId)
      .orderBy(asc(schema.organizations.name));
    res.send(rows);
  }));

  // The gallery spaces of one organization.
  router.get('/organizations/:organizationId', readLimit, handle(async (req, res) => {
    const organizationId = OrganizationIdSchema.parse(req.params.organizationId);
    const [organization] = await db.select({ name: schema.organizations.name, type: schema.organizations.type })
      .from(schema.organizations).where(eq(schema.organizations.organizationId, organizationId));
    if (!organization) { res.status(404).send({ message: 'Hittades inte' }); return; }
    const [logo] = await db.select({ version: schema.organizationLogos.version }).from(schema.organizationLogos)
      .where(eq(schema.organizationLogos.organizationId, organizationId));
    const spaces = await db.select({
      vrSpaceId: schema.vrSpaces.vrSpaceId,
      name: schema.vrSpaces.name,
      description: schema.vrSpaces.description,
    }).from(schema.vrSpaces)
      .where(and(guestVisible, eq(schema.vrSpaces.organizationId, organizationId)))
      .orderBy(asc(schema.vrSpaces.name))
      .limit(200);
    res.send({ organization: { ...organization, logoVersion: logo?.version ?? null }, spaces });
  }));

  // An organization's logo. Public on purpose: it is shown on the guest pages. Only PNG/JPEG/WebP bytes are ever stored.
  router.get('/logo/:organizationId', readLimit, handle(async (req, res) => {
    const organizationId = OrganizationIdSchema.parse(req.params.organizationId);
    const [logo] = await db.select({ data: schema.organizationLogos.data, mimeType: schema.organizationLogos.mimeType })
      .from(schema.organizationLogos).where(eq(schema.organizationLogos.organizationId, organizationId));
    if (!logo) { res.status(404).send({ message: 'Ingen logga' }); return; }
    res.set({
      'Content-Type': logo.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=86400', // the ?v= version in the URL makes a changed logo load fresh
    });
    res.send(logo.data);
  }));

  // Private persons' spaces (not owned by an organization), newest first, in pages ("load more").
  router.get('/personal', readLimit, handle(async (req, res) => {
    const { offset, limit } = z.object({
      offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
      limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(24),
    }).parse(req.query);
    const rows = await db.select({
      vrSpaceId: schema.vrSpaces.vrSpaceId,
      name: schema.vrSpaces.name,
      description: schema.vrSpaces.description,
    }).from(schema.vrSpaces)
      .where(and(guestVisible, isNull(schema.vrSpaces.organizationId)))
      .orderBy(desc(schema.vrSpaces.createdAt), asc(schema.vrSpaces.vrSpaceId))
      .limit(limit + 1).offset(offset);
    res.send({ spaces: rows.slice(0, limit), hasMore: rows.length > limit });
  }));

  // Guest token that only lets the guest into ONE space (enforced by the media server).
  router.post('/enter', rateLimit('gallery-enter', 60, 10 * 60 * 1000), handle(async (req, res) => {
    const { vrSpaceId, username } = z.object({
      vrSpaceId: VrSpaceIdSchema,
      username: z.string().trim().min(2).max(40).optional(),
    }).parse(req.body);
    const [space] = await db.select({ vrSpaceId: schema.vrSpaces.vrSpaceId }).from(schema.vrSpaces)
      .where(and(guestVisible, eq(schema.vrSpaces.vrSpaceId, vrSpaceId)));
    if (!space) { res.status(404).send({ message: 'Miljön finns inte i gästgalleriet.' }); return; }
    const token = createJwt({
      username: username ?? `Gäst-${randomUUID().slice(0, 4)}`,
      role: 'guest',
      userId: UserIdSchema.parse(randomUUID()),
      guestVrSpaceId: vrSpaceId,
    }, 120);
    res.send(token);
  }));

  return router;
}
