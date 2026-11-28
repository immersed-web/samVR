import express, { json as parseJsonBody } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createJwt, verifyJwtToken } from 'shared-modules/jwtUtils';
import createUserRouter from './userRoutes.js';
import createOrganizationRouter from './organizationRoutes.js';
import createOnboardingRouter, { rateLimit } from './onboardingRoutes.js';
import createGalleryRouter from './galleryRoutes.js';
import createAdminUserRouter from './adminUserRoutes.js';
import createMessageRouter from './messageRoutes.js';
import createOrgUserRouter from './orgUserRoutes.js';
import createOrgMediaRouter from './orgMediaRoutes.js';
import {default as Haikunator} from 'haikunator';
import wordlist from './haikunator-wordlist.js';
import { extractMessageFromCatch } from 'shared-modules/utilFns';
import session from 'express-session';
// import { Pool } from 'pg';
import pg from 'pg';
const { Pool } = pg;
import connectPgSimple from "connect-pg-simple";
import { JwtUserData, UserIdSchema, type VrSpaceId } from 'schemas';

const haikunator = new Haikunator({
  adjectives: wordlist.adjectives,
  nouns: wordlist.nouns,
  defaults: { tokenLength: 2 }
});

// console.log('environment: ', process.env);
const devMode = process.env.DEVELOPMENT;
const localMode = process.env.EXPOSED_LOCAL === 'true';

const app = express();


// We need to trust first proxy. Foremost to get secure cookie to function  properly
app.set('trust proxy', 1);

let cookieSecure = true;
let originUrls: string[] = [];
if (localMode) {
  // NOTE: I couldnt come up with a way to allow all origins so we have hardcoded the devservers url here
  originUrls = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  console.log('allowing cors for local development: ', originUrls);

  console.log('allowing cookie despite not https');
  cookieSecure = false;
} else {
  if (!process.env.EXPOSED_SERVER_URL) {
    console.error('no EXPOSED_SERVER_URL provided from env');
    process.exit(1);
  }
  originUrls = [`https://${process.env.EXPOSED_SERVER_URL}`];
  // Production guard: never run a public server in dev mode or with weak secrets.
  if (devMode) {
    console.error('DEVELOPMENT is set while EXPOSED_LOCAL is not "true". Refusing to start a public server in dev mode.');
    process.exit(1);
  }
  for (const name of ['SESSION_KEY', 'JWT_SECRET'] as const) {
    if ((process.env[name] ?? '').length < 32) {
      console.error(`${name} must be at least 32 characters in production.`);
      process.exit(1);
    }
  }
  console.log('restricting CORS for https:', originUrls);
}

app.use(cors({ credentials: true, origin: originUrls }));

app.use((req, res, next) => {
  return parseJsonBody({ limit: '1mb' })(req, res, (err) => { // 1 MB: user import can carry up to 500 rows
    if (err) {
      //There was error!!
      const msg = extractMessageFromCatch(err, 'failed to parse request');
      res.status(400).send({ message: 'Ogiltig förfrågan' }); console.error('bad request body:', msg);
    } else {
      next();
    }
  });
});

if (!process.env.SESSION_KEY) {
  console.error('no session key provided!!!');
  throw new Error('no session key provided when starting api server');
}

// TODO: use a store for persisting sessions, preferably compatible with drizzle
const sessionDBAccess = new Pool({
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  host: process.env.DATABASE_HOST || 'localhost',
  port: 5432,
  database: process.env.DATABASE_NAME,
})
const pgSession = connectPgSimple(session);
app.use(session({
  secret: process.env.SESSION_KEY,
  cookie: {
    httpOnly: true,
    secure: cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000 // ms
  },
  name: process.env.EXPOSED_PROJECT_NAME,
  resave: false,
  saveUninitialized: false,
  // store: prismaSessionStore
  store: new pgSession({
    pool: sessionDBAccess,
    tableName: 'session',
  })
}),
);
const userRouter = createUserRouter();
app.use('/user/', userRouter);
app.use('/org/', createOrganizationRouter());
app.use('/onboarding/', createOnboardingRouter());
app.use('/gallery/', createGalleryRouter());
app.use('/manage/users', createAdminUserRouter());
app.use('/messages/', createMessageRouter());
app.use('/manage/org/:organizationId/users', createOrgUserRouter());
app.use('/manage/org/:organizationId/media', createOrgMediaRouter());

// const apiRouter = createApiRouter();
// app.use('/', apiRouter);


app.get('/health', (req, res) => {
  res.status(200).send({
    message: 'I am Healthy! time:' + Date.now(),
  });
});

app.get('/guest-jwt', rateLimit('guest-jwt', 60, 10 * 60 * 1000), (req, res) => {

  let haikuName = haikunator.haikunate();
  let userId = UserIdSchema.parse(randomUUID());
  let guestVrSpaceId: VrSpaceId | undefined; // set for guests who came in through the public gallery
  if(req.query && req.query['prevToken']){
    try {

      const previousToken = req.query['prevToken'];
      if(typeof previousToken !== 'string'){
        throw new Error('the old token you provided was invalid! Please stop this madness😥😥');
      }
      const decoded = verifyJwtToken(previousToken);
      if(decoded.role !== 'guest'){
        throw new Error('only guests can refresh tokens using the previous one');
      }
      userId = decoded.userId;
      haikuName = decoded.username;
      guestVrSpaceId = decoded.guestVrSpaceId; // a refreshed token must keep its one-space limit
    } catch(e){
      console.error((e as Error).message);
      res.status(400).send('no bueno! The old token you gave was no good');
      return;
    }
  }
  if(req.query && req.query['username']){
    try {
      const requestedName = req.query['username'];
      if(typeof requestedName !== 'string'){
        throw new Error('invalid username provided! Please stop this madness😥😥');
      }
      const trimmedName = requestedName.trim();
      if(trimmedName.length < 1 || trimmedName.length > 40){
        throw new Error('username must be 1-40 characters');
      }
      haikuName = trimmedName;
    } catch(e: unknown){
      console.error((e as Error).message);
      // console.error('failed to parse incoming jwt, is it expired?');
      res.status(400).send('failed. Did you supply a malformed username?');
      return;
    }
  }
  const guestObject: JwtUserData = {
    username: haikuName,
    role: 'guest',
    userId,
    ...(guestVrSpaceId ? { guestVrSpaceId } : {}),
  };
  const jwt = createJwt(guestObject, 120);
  
  //TEMP DEBUG 
  // const expSecondsTimestamp = verifyJwtToken(jwt).exp?? Infinity;
  // console.log('created guestJwt that expires:', expSecondsTimestamp);
  // const now = Date.now();
  // const dt = new Date().toUTCString();
  // console.log('UTC now:', dt);
  // console.log('now is: ', now);
  // console.log('jwt expires in (millis): ', expSecondsTimestamp*1000 - now );
  
  res.send(jwt);
});


const port = Number.parseInt(process.env.EXPOSED_AUTH_PORT || '3333');
app.listen(port, () => {
  console.log(`listening on ${port}`);
  if (process.env.DEVELOPMENT)
    console.log('Running in DEVELOPMENT mode!!!');
  else
    console.log('Running in PRODUCTION mode');
});
