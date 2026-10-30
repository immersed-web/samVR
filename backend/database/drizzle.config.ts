import { defineConfig } from "drizzle-kit";
import { databaseUrl } from './src/connection';
// import { config } from 'dotenv';
// config({
//   path: '../../.env'
// })

// console.log(process.env.DATABASE_URL);

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql", // "mysql" | "sqlite" | "postgresql"
  dbCredentials: {
    url: databaseUrl(),
  },
  verbose: true,
  strict: true,
});
