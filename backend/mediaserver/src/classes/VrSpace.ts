import { ClientTransforms, ConnectionId, UserId, VrSpaceId } from 'schemas';
import { types as soupTypes } from 'mediasoup';
import { throttle, pick } from 'lodash-es';
import type { UserClient, Stream } from './InternalClasses.js';

import { Log } from 'debug-level';
import { VrSpaceWithIncludes, db, queryVrSpaceWithIncludes, schema } from 'database';
import { getMediasoupWorker } from 'modules/soupWorkers.js';
import mediasoupConfig from 'soupConfig.js';
const log = new Log('VR:Space');
process.env.DEBUG = 'VR:Space*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

export class VrSpace {
  private dbData: VrSpaceWithIncludes;
  // private clients: Venue['clients'];
  private clients: Map<ConnectionId, UserClient>;

  get vrSpaceId() {
    return this.dbData.vrSpaceId;
  }

  router: soupTypes.Router;

  pendingTransforms: ClientTransforms = {};
  constructor(vrSpace: VrSpaceWithIncludes, router: soupTypes.Router) {
    this.router = router;
    this.dbData = vrSpace;
    this.clients = new Map();
  }

  // get isOpen(){
  //   return this._isOpen;
  // }

  // open () {
  //   this._isOpen = true;
  // }

  // close () {
  //   this._isOpen = false;
  //   this.clients.forEach(client => {
  //     this.removeClient(client);
  //   });
  // }

  getPublicState() {
    const returnState = this.dbData;
    const clientsWithProducers = Array.from(this.clients.entries()).map(([cId, client]) => {
      const cData = pick(client.getPublicState(), ['userId', 'connectionId', 'producers', 'role', 'username', 'transform']);
      return [cId, cData] as const;
    });
    const clientsRecord = Object.fromEntries(clientsWithProducers);
    return { ...returnState, clients: clientsRecord as Record<ConnectionId, (typeof clientsRecord)[string]> };
  }

  addClient(client: UserClient) {
    this.clients.set(client.connectionId, client);
    client._setVrSpace(this.vrSpaceId);
    log.info(`added client ${client.connectionId} to vrSpace`);
    this._notifyStateUpdated('client added to vrSpace');
  }

  removeClient(client: UserClient) {
    this.clients.delete(client.connectionId);
    client._setVrSpace(undefined);
    this._notifyStateUpdated('client removed from vrSpace');
  }

  sendPendingTransforms: () => void = throttle(() => {
    this.emitTransformsToAllClients();
    this.pendingTransforms = {};
  }, 100, {
    trailing: true
  });
  
  _notifyStateUpdated(reason?: string){
    const data = this.getPublicState();
    this.clients.forEach(c => {
      log.info(`notifying vrSpaceState (${reason}) to client ${c.username} (${c.connectionId})`);
      c.eventSender.vrSpace.vrSpaceStateUpdated({ data, reason });
    });
  }

  emitTransformsToAllClients = () => {
    this.clients.forEach(c => {
      c.eventSender.vrSpace.clientTransforms(this.pendingTransforms);
    });
  };

  // make this instance eligible for GC. Make sure we cut all the references to the instance in here!
  unload() {
    //clean up listeners and such in here!
    this.clients.forEach(client => {
      client.eventSender.vrSpace.vrSpaceWasUnloaded({ vrSpaceId: this.vrSpaceId });
    })
    this.router.close();
    VrSpace.vrSpaces.delete(this.vrSpaceId);
  }
  
  // Static stuff for global housekeeping
  private static vrSpaces: Map<VrSpaceId, VrSpace> = new Map();

  static async loadVrSpace(vrSpaceId: VrSpaceId, worker?: soupTypes.Worker) {
    log.info(`loading vrSpace ${vrSpaceId}`);
    const dbResponse = await queryVrSpaceWithIncludes.execute({ vrSpaceId });
  // const response = await prismaClient.virtualSpace.findUnique({
  //   where: {
  //     vrId: vrSpaceId,
  //   },
  //   include: {
  //     virtualSpace3DModel: true,
  //   }
    // });
    if (!dbResponse) {
      throw Error('failed to load vrSpace. Didnt find vrSpace with that id in db');
    }
    if (!worker) {
      worker = getMediasoupWorker();
    }
    const router = await worker.createRouter(mediasoupConfig.router);
    const vrSpace = new VrSpace(dbResponse, router);
    VrSpace.vrSpaces.set(vrSpace.vrSpaceId, vrSpace);
    return vrSpace;
  }

  static async createNewVrSpace(name: string, ownerUserId: UserId) {
    log.info(`creating new vrSpace ${name} for user ${ownerUserId}`);
    try {
      const [response] = await db.insert(schema.vrSpaces).values({
        name,
        ownerUserId
      }).returning()
      return response.vrSpaceId;
    } catch (e) {
      log.error(e);
      throw e;
    }
  }

  static getVrSpace(vrSpaceId: VrSpaceId) {
    const vrSpace = VrSpace.vrSpaces.get(vrSpaceId);
    // log.info('get vrSpace', vrSpace);
    // if (!vrSpace) {
    //   throw new Error('No vrSpace with that id is loaded');
    // }
    return vrSpace;
  }
}