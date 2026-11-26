import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema } from 'database';
import { isLoggedIn } from './utils.js';

/** A user's own inbox: messages sent by administrators. Everything is scoped to the logged-in account. */

const handle = (fn: RequestHandler): RequestHandler => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    if (e instanceof z.ZodError) { res.status(400).send({ message: 'Ogiltiga uppgifter' }); return; }
    console.error('message route error:', e);
    res.status(500).send({ message: 'Internal error' });
  }
};

export default function createMessageRouter() {
  const router = Router();

  router.get('/summary', isLoggedIn, handle(async (req, res) => {
    const [{ unread }] = await db.select({ unread: sql<number>`count(*)::int` }).from(schema.userMessages)
      .where(and(eq(schema.userMessages.userId, req.session.userId!), isNull(schema.userMessages.readAt)));
    res.send({ unread });
  }));

  router.get('/', isLoggedIn, handle(async (req, res) => {
    const userId = req.session.userId!;
    const messages = await db.select({
      messageId: schema.userMessages.messageId,
      subject: schema.userMessages.subject,
      body: schema.userMessages.body,
      createdAt: schema.userMessages.createdAt,
      readAt: schema.userMessages.readAt,
      from: schema.users.username,
    }).from(schema.userMessages)
      .leftJoin(schema.users, eq(schema.users.userId, schema.userMessages.fromUserId))
      .where(eq(schema.userMessages.userId, userId))
      .orderBy(desc(schema.userMessages.createdAt)).limit(100);
    res.send({ unread: messages.filter(m => !m.readAt).length, messages });
  }));

  router.post('/read', isLoggedIn, handle(async (req, res) => {
    const { messageId } = z.object({ messageId: z.string().uuid().optional() }).parse(req.body ?? {});
    await db.update(schema.userMessages).set({ readAt: sql`(now() at time zone 'utc')` as unknown as Date })
      .where(and(
        eq(schema.userMessages.userId, req.session.userId!),
        isNull(schema.userMessages.readAt),
        messageId ? eq(schema.userMessages.messageId, messageId) : undefined,
      ));
    res.send({ ok: true });
  }));

  router.post('/delete', isLoggedIn, handle(async (req, res) => {
    const { messageId } = z.object({ messageId: z.string().uuid() }).parse(req.body);
    await db.delete(schema.userMessages).where(and(eq(schema.userMessages.userId, req.session.userId!), eq(schema.userMessages.messageId, messageId)));
    res.send({ ok: true });
  }));

  return router;
}
