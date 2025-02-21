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
const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

try {
  await db.transaction(async (tx) => {
    const createdUsers = [];
    let newUser = await tx.insert(schema.users).values({
      password: hashedPassword,
      username: 'superadmin',
      role: 'superadmin',
    }).returning();
    createdUsers.push(newUser[0]);
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