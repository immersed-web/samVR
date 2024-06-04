process.env.DEBUG_LEVEL = 'DEBUG';
import { db, schema } from 'database';
import { Log } from 'debug-level';
const uLog = new Log('u');
process.env.DEBUG = 'u*, ' + process.env.DEBUG;
uLog.enable(process.env.DEBUG);

const response = await db.query.users.findFirst({
  // where: (users, { eq }) => eq(users.username, 'klas'),
});

// console.log(response)
uLog.debug(response);
uLog.log(response);
uLog.info(response);


process.exit(0);