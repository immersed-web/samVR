import { serve } from '@hono/node-server'
import { HttpStatus } from 'http-status-ts';
import { serveStatic } from '@hono/node-server/serve-static'
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono'
import { cors } from 'hono/cors'
// import { logger } from 'hono/logger';
// import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
// import { basicAuth } from 'hono/basic-auth'
import { jwt } from 'hono/jwt';
import { env } from 'hono/adapter';
import { randomUUID } from 'crypto'
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import fs from 'fs'
import promise from 'fs/promises';

import { hc, InferRequestType, InferResponseType } from 'hono/client'


import { db, schema } from 'database'
import { AssetIdSchema, AssetType, AssetTypeSchema, JwtPayload, JwtPayloadSchema, hasAtLeastSecurityRole, resolveMaxUploadBytes, assetTypesToExtensionsMap, createFileExtensionSchema, getAssetTypeFromExtension } from 'schemas'
import { and, eq } from 'drizzle-orm';
import path from 'path';
import { z } from 'zod';
import { compress } from 'hono/compress';
import sharp from 'sharp';
import { bodyLimit } from 'hono/body-limit';
// import { createBrotliCompress } from 'node:zlib';
// const brotli = createBrotliCompress();

const savePathAbsolute = path.resolve('.', 'uploads')
const savePathRelative = './uploads/'
const devMode = process.env.DEVELOPMENT === 'true';
const localMode = process.env.EXPOSED_LOCAL === 'true';
const maxUploadBytes = resolveMaxUploadBytes(process.env.EXPOSED_MAX_UPLOAD_BYTES);
const maxUploadBodyBytes = maxUploadBytes + 1024 * 1024;

await promise.mkdir(savePathAbsolute, { recursive: true });

// const authHandler = basicAuth({ username: 'gunnar', password: 'hemligt' })
// const jwtHandler = jwt({ secret: 'secret' });
// const jwtAuthHandler = createMiddleware<{ Variables: { jwtPayload: JwtPayload } }>(jwtHandler);

// const user = await db.query.users.findFirst({
//   columns: basicUserSelect
// });
// if (!user) {
//   process.exit(1);
// }

//cache for 4 days
const maxAge = 4 * 24 * 60 * 60;
const publicRoutes = new Hono();
publicRoutes.get('/file/:filename',
  compress(),
  async (c, next) => {
    const scaledown = Number.parseInt(c.req.query('scaledown') ?? '', 10);
    const filename = c.req.param('filename');
    const imageMatch = /^[a-f0-9-]{36}\.(png|jpe?g|webp)$/i.exec(filename);
    if (!scaledown || scaledown < 1 || !imageMatch) return next();

    const imagePath = path.join(savePathAbsolute, filename);
    if (!fs.existsSync(imagePath)) return next();
    const imgHandler = sharp(imagePath);
    const metadata = await imgHandler.metadata();
    if (!metadata.width) return next();
    const newWidth = Math.max(1, Math.round(metadata.width / scaledown));
    const resized = await imgHandler.resize({ withoutEnlargement: true, width: newWidth }).toBuffer();
    const format = imageMatch[1].toLowerCase();
    return c.body(resized, 200, {
      'Cache-Control': `public, immutable, max-age=${maxAge}`,
      'Content-Type': `image/${format === 'jpg' ? 'jpeg' : format}`,
    });
  },
  serveStatic({
    // precompressed: true,
    onFound: async (path, c) => {
      c.header('Cache-Control', `public, immutable, max-age=${maxAge}`)

    },
    rewriteRequestPath: (path) => {
      // strip the "file/"-part of the path as we use that in the root instead.
      const newPath = path.substring(5);
      // console.log(newPath);
      return newPath;
    },
    root: savePathRelative,
  }),
  )
  .get('/test', (c) => {
    return c.text('test', HttpStatus.OK);
  });

const privateRoutes = new Hono<{ Variables: { jwtPayload: JwtPayload } }>()
  .use((c, next) => {
    const { JWT_SECRET } = env<{ JWT_SECRET: string }>(c);
    // console.log(c.env);
    const mw = jwt({ secret: JWT_SECRET, alg: 'HS256' });

    return mw(c, next);
  })
// .use(logger())
// .use(async (c, next) => {
//   console.log(c.req.header());
//   return next();
// })

  // TODO: More elaborate ownership check where users are allowed to delete assets belonging to something they have edit rights to.
  // Example is deleting/changing navmesh or world model if you have edit rights to a VrSpace but isnt the owner of the asset itself
  .delete('/delete', zValidator('json', z.object({ assetId: AssetIdSchema })), async (c, next) => {
    const { assetId } = c.req.valid('json');
    const user = c.get('jwtPayload');
    const deleteResponse = await db.transaction(async (tx) => {
      const foundAsset = await tx.query.assets.findFirst({
        where: eq(schema.assets.assetId, assetId),
      })
      if (!foundAsset) {
        throw new HTTPException(HttpStatus.NOT_FOUND, { message: 'no asset found in db' });
      }
      if (foundAsset.ownerUserId !== user.userId) {
        throw new HTTPException(HttpStatus.FORBIDDEN, { message: 'not allowed' });
      }

      const filePath = `${savePathAbsolute}/${foundAsset.generatedName}`
      const exists = fs.existsSync(filePath);
      if (!exists) {
        console.error('no such file found. Apparently filesystem and db arent in sync.');
        throw new HTTPException(HttpStatus.INTERNAL_SERVER_ERROR, { message: 'no such file found' });
      }

      // manual cascade here because we have polymorphic relations
      const placedObjects = await db.delete(schema.placedObjects).where(and(eq(schema.placedObjects.type, 'asset'), eq(schema.placedObjects.objectId, assetId))).returning();
      console.log('deleted following related placedObjects when deleting asset:', placedObjects);
      const dbResponse = await tx.delete(schema.assets).where(eq(schema.assets.assetId, assetId)).returning();
      await fs.promises.unlink(filePath);
      return dbResponse;
    })
    console.log('file deleted:', deleteResponse);
    return c.text('file deleted', HttpStatus.OK);
  })
  .post('/upload', async (c, next) => {
    const parsedUser = JwtPayloadSchema.safeParse(c.get('jwtPayload'));
    if (!parsedUser.success || !hasAtLeastSecurityRole(parsedUser.data.role, 'user')) {
      return c.json({ error: 'not authorized to upload' }, HttpStatus.FORBIDDEN);
    }
    const user = await db.query.users.findFirst({
      columns: { role: true },
      where: eq(schema.users.userId, parsedUser.data.userId),
    });
    if (!user || !hasAtLeastSecurityRole(user.role, 'user')) {
      return c.json({ error: 'not authorized to upload' }, HttpStatus.FORBIDDEN);
    }
    await next();
  }, bodyLimit({
    maxSize: maxUploadBodyBytes,
    onError: c => c.json({ error: 'upload too large' }, HttpStatus.PAYLOAD_TOO_LARGE, { Connection: 'close' }),
  }), zValidator('form', z.object({
    file: z.instanceof(File),
    assetType: AssetTypeSchema.optional(),
    showInUserLibrary: z.preprocess(v => {
      // console.log('zod showinlib raw input:', v);
      return v === 'true' ? true : v === 'false' ? false : undefined
    }, z.boolean().optional()),
  })), async (c, next) => {
    let { file, assetType, showInUserLibrary } = c.req.valid('form');
    const user = c.get('jwtPayload');
    if (file.size > maxUploadBytes) {
      return c.json({ error: 'upload too large' }, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    console.log('showInUserLibrary', showInUserLibrary);
    // console.log(file.type);
    const incomingExtension = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
    let acceptedAssetTypes = assetType ?? Object.keys(assetTypesToExtensionsMap) as AssetType[]
    const validatedExtension = createFileExtensionSchema(acceptedAssetTypes).safeParse(incomingExtension);
    if (validatedExtension.error) {
      return c.json({ error: 'unallowed file extension' as const }, HttpStatus.FORBIDDEN);
    }
    if (!assetType) {
      assetType = getAssetTypeFromExtension(incomingExtension);
      if (!assetType) {
        console.error('couldnt match extension to a valid asset type');
        return c.json({ error: 'couldnt match extension to a valid asset type' as const }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
    const uuid = randomUUID();
    const generatedName = `${uuid}.${validatedExtension.data}`;
    const filePath = path.join(savePathAbsolute, generatedName);
    let createdFile = false;
    let fileHandle: Awaited<ReturnType<typeof promise.open>> | undefined;
    let dbResponse;
    try {
      if (c.req.raw.signal.aborted) throw new Error('upload request aborted');
      fileHandle = await promise.open(filePath, 'wx', 0o600);
      createdFile = true;
      await pipeline(
        Readable.fromWeb(file.stream() as ReadableStream<any>),
        fileHandle.createWriteStream(),
        { signal: c.req.raw.signal },
      );
      fileHandle = undefined;
      if (c.req.raw.signal.aborted) throw new Error('upload request aborted');
      [dbResponse] = await db.transaction(async tx => {
        const [owner] = await tx.select({ role: schema.users.role }).from(schema.users)
          .where(eq(schema.users.userId, user.userId)).for('share');
        if (!owner || !hasAtLeastSecurityRole(owner.role, 'user')) {
          throw new HTTPException(HttpStatus.FORBIDDEN, { message: 'not authorized to upload' });
        }
        return tx.insert(schema.assets).values({
          assetType,
          assetFileExtension: validatedExtension.data,
          generatedName,
          size: file.size,
          mimeType: file.type,
          originalFileName: file.name,
          ownerUserId: user.userId,
          showInUserLibrary
        }).returning();
      });
    } catch (error) {
      if (fileHandle) await fileHandle.close().catch(closeError => console.error('failed to close upload', closeError));
      if (createdFile) await promise.unlink(filePath).catch(cleanupError => console.error('failed to remove incomplete upload', cleanupError));
      if (error instanceof HTTPException) throw error;
      console.error('upload failed', error);
      return c.json({ error: 'upload failed' as const }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    console.log('file uploaded. db entry:', dbResponse);
    return c.json(dbResponse, HttpStatus.OK);
  });

const app = new Hono<{ Variables: { jwtPayload: JwtPayload } }>();

if (localMode) {
  app.use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );
} else {
  app.use(
    '*',
    cors({
      origin: [`https://${process.env.EXPOSED_SERVER_URL}`],
      credentials: true
    })
  )
}

app.route('/', publicRoutes)
app.route('/', privateRoutes);

const port = Number.parseInt(process.env.EXPOSED_FILESERVER_PORT ?? '3000');
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})

export type AppType = typeof app;
type HC = ReturnType<typeof hc<AppType>>
export type UploadRequest = InferRequestType<HC['upload']['$post']>;
export type UploadResponse = InferResponseType<HC['upload']['$post']>
export type ExtractSuccessResponse<T> = T extends { error: string } ? never : T
