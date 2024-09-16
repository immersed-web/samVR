import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";
import bcrypt from 'bcrypt'

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL env var');
}
// const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle(queryClient, { schema });

// if (!await db.query.users.findFirst()) {

//   const res = await db.insert(schema.users).values({
//     password: 'hemligt',
//     username: 'gunnar',
//   });
//   console.log(res);
// }

// async function createWithIncludes<T extends (typeof schema)[keyof typeof schema]>(includes: T) {

// }
const hashedPassword = bcrypt.hashSync('123', 10);

try {
  await db.transaction(async (tx) => {
    const createdUsers = [];
    let newUser = await tx.insert(schema.users).values({
      password: hashedPassword,
      username: 'klas',
      role: 'gunnar',
    }).returning();
    createdUsers.push(newUser[0]);
    newUser = await tx.insert(schema.users).values({
      password: hashedPassword,
      username: 'göran',
      role: 'user',
    }).returning();
    createdUsers.push(newUser[0]);
    newUser = await tx.insert(schema.users).values({
      password: hashedPassword,
      username: 'fia',
      role: 'user',
    }).returning();
    createdUsers.push(newUser[0]);
    console.log(createdUsers);
    // const cameraUuid = randomUUID();
    // console.log(cameraUuid);
    const newStream = await tx.insert(schema.streams).values({
      name: 'cool stream',
      ownerUserId: newUser[0].userId,
      visibility: 'public',
    }).returning();
    console.log(newStream);
    const newCamera = await tx.insert(schema.cameras).values({
      name: 'cool camera',
      orientation: 0,
      fovStart: 0,
      streamId: newStream[0].streamId,
    }).returning();
    console.log(newCamera);
    const updatedStream = await tx.update(schema.streams).set({ mainCameraId: newCamera[0].cameraId }).where(eq(schema.streams.streamId, newStream[0].streamId)).returning();
    console.log(updatedStream);
  });
} catch (e: unknown) {
  console.error('failed to seed', e);
}


// let response = await db.query.users.findFirst();
// console.log(response?.updatedAt?.toLocaleString());

// response = await db.query.users.findFirst({
//   with: {
//     streams: true,
//   }
// })
// console.log(response);

process.exit();