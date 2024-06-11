import { ClientTransforms, ConnectionId, UserId, VrSpaceId } from 'schemas';
import { throttle, pick } from 'lodash-es';
import type { UserClient, Venue } from './InternalClasses.js';

import { Log } from 'debug-level';
import { VrSpaceWithIncludes, db, queryVrSpaceWithIncludes } from 'database';
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

  pendingTransforms: ClientTransforms = {};
  constructor(vrSpace: VrSpaceWithIncludes) {
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
    log.info(`added client ${client.connectionId} to vrSpace`);
    client.isInVrSpace = true;
    this._notifyStateUpdated('client added to vrSpace');
  }

  removeClient (client: UserClient){
    client.isInVrSpace = false;
    this.clients.delete(client.connectionId);
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
      // for(const [id, c] of Object.entries(data.clients)){
      //   log.info(`${id} pos: ${c.transform?.head.position}`);
      // }
      // c.notify.vrSpaceStateUpdated?.({data, reason});
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
  }
  
  static async loadVrSpace(vrSpaceId: VrSpaceId) {
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
    return new VrSpace(dbResponse);
  }
}
