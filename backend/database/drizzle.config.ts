import { defineConfig } from "drizzle-kit";
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
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});