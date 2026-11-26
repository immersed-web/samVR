import { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from 'database';

export const isLoggedIn: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(403).send({ message: 'You shall not pass!!!' });
    return;
  }
  try {
    // Blocked accounts lose their session on the next request. Guests have no row here and are not affected.
    const [account] = await db.select({ blockedAt: schema.users.blockedAt }).from(schema.users).where(eq(schema.users.userId, userId));
    if (account?.blockedAt) {
      await new Promise<void>(resolve => req.session.destroy(() => resolve()));
      res.status(403).send({ message: 'Kontot är spärrat. Kontakta administratören.' });
      return;
    }
  } catch (e) {
    console.error('could not check whether the account is blocked:', e);
    res.status(500).send({ message: 'Internal error' });
    return;
  }
  next();
  return;
};
