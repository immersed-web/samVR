// process.env.DEBUG = 'mediasoup*';
// process.env.DEBUG_LEVEL = 'INFO'
import { Log } from 'debug-level';
const logUws = new Log('uWebSockets');
process.env.DEBUG = 'uWebSockets*, ' + process.env.DEBUG;
logUws.enable(process.env.DEBUG);
const log = new Log('Index');
process.env.DEBUG = 'Index*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);


import { attachMediasoupObservers } from './soupObservers.js';
let printSoupStats : (() => void) | undefined;
if(process.env.DEVELOPMENT){
  printSoupStats = attachMediasoupObservers();
}


import { printClassInstances } from './DebugObservers.js';
import uWebSockets, { WebSocket } from 'uWebSockets.js';
const { DEDICATED_COMPRESSOR_3KB } = uWebSockets;
import { createWorkers } from './modules/soupWorkers.js';
import { verifyJwtToken } from 'shared-modules/jwtUtils';
import { extractMessageFromCatch } from 'shared-modules/utilFns';
import { JwtUserData, JwtUserDataSchema, hasAtLeastSecurityRole, UserId, UserIdSchema, ClientType } from 'schemas';
import { applyWSHandler } from './trpc/ws-adapter.js';
import { appRouter, AppRouter } from './routers/appRouter.js';
import { loadUserDBData, SenderClient, UserClient } from './classes/InternalClasses.js';
import { Context } from 'trpc/trpc.js';

export type MyWebsocketType = WebSocket<WSUserData>;

// Usually there is one connection per user. But...
// Privileged users might be allowed to have several connections active simultaneously
const connectedUsers: Map<UserId, MyWebsocketType[]> = new Map();
const clientConnections: Map<MyWebsocketType, UserClient | SenderClient> = new Map();

createWorkers();

const stdin = process.stdin;

// console.log('environment: ', process.env);

if(stdin && stdin.isTTY){
  // without this, we would only get streams once enter is pressed
  stdin.setRawMode( true );

  // resume stdin in the parent process (node app won't quit all by itself
  // unless an error or process.exit() happens)
  stdin.resume();

  // i don't want binary, do you?
  stdin.setEncoding( 'utf8' );

  // on any data into stdin
  stdin.on('data', function (key) {
    const asString = key.toString();
    // ctrl-c ( end of text )
    switch(asString){
      case '\u0003' :
        process.exit();
        break;
      case 'm':
        printSoupStats?.();
        break;
      case 'c':
        printClassInstances(clientConnections);
        break;
      // write the key to stdout all normal like
    }
    process.stdout.write(asString);
  });
}




const { onSocketOpen, onSocketMessage, onSocketClose } = applyWSHandler<AppRouter, Context>({
  router: appRouter,
  // onError: (err) => {
  //   console.error('error handling request', err);
  // }
});


const app = uWebSockets.App();

type WSUserData = { jwtUserData: JwtUserData, clientType: ClientType, dbData?: Awaited<ReturnType<typeof loadUserDBData>> }
app.ws<WSUserData>('/*', {

  /* There are many common helper features */
  idleTimeout: 64,
  maxBackpressure: 1024,
  maxLifetime: 0,
  sendPingsAutomatically: true,
  maxPayloadLength: 64 * 1024,
  compression: DEDICATED_COMPRESSOR_3KB,
  // ping(ws, message) {
  //   const connection = clientConnections.get(ws);
  //   if(!connection){
  //     console.warn('ping received from ws that wasnt in connection map:', message);
  //     return;
  //   }
  //   // console.log(`ping received from ${connection.username} (${connection.connectionId})`,Buffer.from(message).toString());
  // },
  // pong(ws, message) {
  //   const connection = clientConnections.get(ws);
  //   if(!connection){
  //     console.warn('pong received from ws that wasnt in connection map:', Buffer.from(message).toString());
  //     return;
  //   }
  //   // console.log(`pong received from ${connection.username} (${connection.connectionId})`, Buffer.from(message).toString());
  // },

  message: (ws, message) => {
    // logUws.info('received message size:', message.byteLength)
    const asString = Buffer.from(message).toString();
    onSocketMessage(ws, asString);
  },
  upgrade: (res, req, context) => {
    // logUws.debug('upgrade request received');
    const upgradeState = {
      aborted: false,
    };
    const secWebSocketKey = req.getHeader('sec-websocket-key');
    const secWebSocketProtocol = req.getHeader('sec-websocket-protocol');
    const secWebSocketExtensions = req.getHeader('sec-websocket-extensions');
    let wsUserData: WSUserData;
    try{
      const url = new URL(`http://localhost?${req.getQuery()}`);
      const receivedToken = url.searchParams.get('token');
      const isSender = url.searchParams.has('sender');
      const connectionType: ClientType = isSender? 'sender' : 'client';
      if(!receivedToken){
        throw Error('no token found in search query');
      }
      // logUws.debug('upgrade request provided this token:', receivedToken);
      const validJwt = verifyJwtToken(receivedToken);

      // logUws.debug('decoded jwt:', validJwt);

      const userDataOnly = JwtUserDataSchema.parse(validJwt);

      if (isSender && !hasAtLeastSecurityRole(userDataOnly.role, 'user')) {
        throw Error('must at least have sender role to do that...');
      }
      const isAlreadyConnected = connectedUsers.has(userDataOnly.userId);
      if (!hasAtLeastSecurityRole(userDataOnly.role, 'user') && isAlreadyConnected) {
        throw Error('already logged in!!!');
      }
      wsUserData = {
        jwtUserData: userDataOnly,
        clientType: connectionType,
      };
    } catch(e){
      const msg = extractMessageFromCatch(e, 'YOU SHALL NOT PASS');
      logUws.error('websocket upgrade was canceled / failed:', msg);
      res.writeStatus('403 Forbidden').end(msg, true);
      return;
    }
    res.onAborted(() => upgradeState.aborted = true);
    const upgradeMe = async () => {
      let dbResponse: Awaited<ReturnType<typeof loadUserDBData>> | undefined = undefined;
      if(wsUserData.jwtUserData.role !== 'guest'){
        try {
          dbResponse = await loadUserDBData(wsUserData.jwtUserData.userId);
          wsUserData.dbData = dbResponse;
          // log.debug('loaded userdata from db: ', dbResponse);
        } catch(e) {
          log.error('Failed to fetch userdata from database');
        }
      }
      if(upgradeState.aborted){
        logUws.error('upgrade was cancelled by client');
        return;
      }
      res.cork(() => {
        res.upgrade<WSUserData>(
          wsUserData,
          /* Spell these correctly */
          secWebSocketKey,
          secWebSocketProtocol,
          secWebSocketExtensions,
          // req.getHeader('sec-websocket-key'),
          // req.getHeader('sec-websocket-protocol'),
          // req.getHeader('sec-websocket-extensions'),
          context
        );
      })
    };
    upgradeMe();

  },
  open: (ws) => {
    const userData = ws.getUserData();
    const connectionType = userData.clientType;
    const userId = UserIdSchema.parse(userData.jwtUserData.userId);
    // logUws.info('socket opened');

    let client: UserClient | SenderClient;
    if(connectionType === 'sender'){
      client = new SenderClient({ jwtUserData: userData.jwtUserData, dbData: userData.dbData, ws });
    } else {
      client = new UserClient({ jwtUserData: userData.jwtUserData, dbData: userData.dbData, ws });
    }

    clientConnections.set(ws, client);

    // Housekeeping our users and connections
    const activeSockets = connectedUsers.get(userId);
    if(activeSockets){
      activeSockets.push(ws);
    } else {
      connectedUsers.set(userId, [ws]);
    }
    // logUws.debug('new client:', client.jwtUserData);


    const context: Context = {...userData.jwtUserData, connectionId: client.connectionId, client, clientType: connectionType};
    onSocketOpen(ws, context);
  },
  drain: (ws) => {
    log.warn('WebSocket backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws, code, msg) => {
    const userData = ws.getUserData();
    logUws.info(`socket diconnected ${userData.jwtUserData.username} (${userData.jwtUserData.userId})`);
    const msgString = Buffer.from(msg).toString();
    logUws.info('closing info -> code:', code, 'msg:', msgString);
    const client = clientConnections.get(ws);
    client?.removeWSInstance();
    if(!client){
      logUws.error('a disconnecting client was not in client list! Something is astray!');
      throw Error('a disconnecting client was not in client list! Something is astray!');
    }
    client.unload();
    clientConnections.delete(ws);

    let activeSockets = connectedUsers.get(userData.jwtUserData.userId);
    if(activeSockets){
      activeSockets = activeSockets.filter(s => s !== ws);
      if(activeSockets.length === 0){
        //no active connections. also remove from connectedUsers dictionary
        connectedUsers.delete(userData.jwtUserData.userId);
      }
    }

    onSocketClose(ws, msgString);
  }
}).listen(Number.parseInt(process.env.MEDIASOUP_PORT || '9001'), (listenSocket) => {
  if (listenSocket) {
    console.log('listenSocket:' ,listenSocket);
    console.log('Listening to port 9001');
  }

});
