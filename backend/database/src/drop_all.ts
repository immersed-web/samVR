import postgres from "postgres";

const queryClient = postgres(process.env.DATABASE_URL);

async function clearDB() {
  let res = await queryClient`DROP SCHEMA public CASCADE`;
  await queryClient`CREATE SCHEMA public;`

  //Restore default permissions
  await queryClient`GRANT ALL ON SCHEMA public TO postgres;`
  await queryClient`GRANT ALL ON SCHEMA public TO public;`
}

clearDB();