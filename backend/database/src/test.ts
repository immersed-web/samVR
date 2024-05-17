import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL env var');
}
// const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle(queryClient, { schema });

if (!await db.query.User.findFirst()) {

  const res = await db.insert(schema.User).values({
    password: 'hemligt',
    username: 'gunnar',
  });
  console.log(res);
}


const response = await db.query.User.findFirst();
console.log(response?.updatedAt?.toLocaleString());

process.exit();