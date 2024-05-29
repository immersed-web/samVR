import { db, schema } from 'database';

const response = await db.query.users.findFirst({
  // where: (users, { eq }) => eq(users.username, 'klas'),
});

console.log(response)


process.exit(0);