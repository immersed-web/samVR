import { serve } from '@hono/node-server'
import { HttpStatus } from 'http-status-ts';
import { serveStatic } from '@hono/node-server/serve-static'
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { basicAuth } from 'hono/basic-auth'
import { jwt, verify } from 'hono/jwt';
import { env } from 'hono/adapter';
import { randomUUID } from 'crypto'
import { Stream } from 'node:stream';
import fs, { existsSync } from 'fs'
import fsPromises from 'fs/promises';

import { basicUserSelect, db, schema } from 'database'
import { AssetIdSchema, AssetType, AssetTypeSchema, JwtPayload, UserId } from 'schemas'
import { eq } from 'drizzle-orm';
import path from 'path';
import { z } from 'zod';

const saveFolder = path.resolve('.', 'uploads', 'temp')

// const authHandler = basicAuth({ username: 'gunnar', password: 'hemligt' })
// const jwtHandler = jwt({ secret: 'secret' });
// const jwtAuthHandler = createMiddleware<{ Variables: { jwtPayload: JwtPayload } }>(jwtHandler);

const user = await db.query.users.findFirst({
  columns: basicUserSelect
});
if (!user) {
  process.exit(1);
}

const app = new Hono<{ Variables: { jwtPayload: JwtPayload } }>()
  .use((c, next) => {
    const { JWT_SECRET } = env<{ JWT_SECRET: string }>(c);
    console.log(JWT_SECRET);
    const mw = jwt({ secret: JWT_SECRET });

    return mw(c, next);
  })
  .get('/', (c) => {
  return c.text('Hello Hono!')
}).get('/file/:assetId', zValidator('param', z.object({ assetId: AssetIdSchema })), serveStatic({
  root: '../../public/uploads/3d_models/',
})).delete('/delete', async (c, next) => {
  const json = await c.req.json();
  const maybeAssetId = json['assetId'];
  const parseResult = AssetIdSchema.safeParse(maybeAssetId);
  // console.log(parseResult);
  if (parseResult.success) {
    // try {
    const result = await db.transaction(async (tx) => {
      const foundAsset = await tx.query.assets.findFirst({
        where: eq(schema.assets.assetId, parseResult.data),
      })
      if (!foundAsset) {
        throw new HTTPException(HttpStatus.NOT_FOUND, { message: 'no asset found in db' });
      }

      const filePath = `${saveFolder}/${foundAsset.generatedName}`
      const exists = existsSync(filePath);
      if (!exists) {
        console.error('no such file found. Apparently filesystem and db arent in sync.');
        throw new HTTPException(HttpStatus.INTERNAL_SERVER_ERROR, { message: 'no such file found' });
      }
      await tx.delete(schema.assets).where(eq(schema.assets.assetId, parseResult.data));
      await fs.promises.unlink(filePath);
      return;
    })
    return c.text('file deleted', HttpStatus.OK);
  }
}).post('/upload', zValidator('form', z.object({ file: z.instanceof(File), assetType: AssetTypeSchema })), async (c, next) => {
  const body = await c.req.parseBody();
  const file = body['file']
  if (!(file instanceof File)) {
    // const badRequest = constants.HTTP_STATUS_BAD_REQUEST as StatusCode;
    // return c.text('no file found in request body', HttpStatus.BAD_REQUEST);
    return c.json({ error: 'no file found in request body' }, HttpStatus.BAD_REQUEST);
  }
  console.log(file.type);
  const extension = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 2);
  console.log(extension);
  // const [mime, extension] = file.type.split('/');
  const parseResult = AssetTypeSchema.safeParse(body['assetType']);
  let assetType: AssetType;
  if (parseResult.success) {
    assetType = parseResult.data;
  } else {
    switch (extension) {
      case 'glb':
        assetType = 'model';
        break;
      case 'pdf':
        assetType = 'document';
        break;
      case 'png':
      case 'jpg':
      case 'jpeg':
        assetType = 'image';
        break;
      case 'mkv':
      case 'mp4':
        assetType = 'video';
        break;
      default:
        assetType = 'unknown';
        break;
    }
  }
  console.log(file.name);
  const uuid = randomUUID();
  const generatedName = `${uuid}.${extension}`;
  // const path = './uploads/temp/';
  const fileStream = file.stream();
  const nodeReadStream = Stream.Readable.fromWeb(fileStream);
  const writeStream = fs.createWriteStream(`${saveFolder}/${generatedName}`);
  nodeReadStream.pipe(writeStream);

  let resolve, reject;
  const fileWritePromise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  writeStream.on('finish', () => {
    resolve();
  });
  writeStream.on('error', (err) => {
    reject('upload failed', err);
  });
  await fileWritePromise;
  const [dbResponse] = await db.insert(schema.assets).values({
    assetType,
    assetFileExtension: extension,
    generatedName: generatedName,
    size: file.size,
    mimeType: file.type,
    originalFileName: file.name,
    ownerUserId: user.userId,
  }).returning();

  // return c.text('file uploaded');
  return c.json({
    assetId: dbResponse.assetId
  }, HttpStatus.OK);
});

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})

export type AppType = typeof app;