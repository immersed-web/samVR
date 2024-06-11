import { Log } from 'debug-level';
const log = new Log('UserClient');
process.env.DEBUG = 'UserClient*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { ClientTransform, ClientTransforms, StreamId, CameraId, ClientType, VrSpaceId } from 'schemas';
import { loadUserDBData, SenderClient, Venue, VrSpace, BaseClient, DataAndReason, BaseClientEventMap } from './InternalClasses.js';
import { effect } from '@vue/reactivity';
import { EventSender, Payload, createTypedEvents } from 'ts-event-bridge/sender';
import { MyWebsocketType } from 'index.js';

type EventMapAdditions = {
  vrSpace: {
    vrSpaceStateUpdated: Payload<DataAndReason<ReturnType<VrSpace['getPublicState']>>>,
    clientTransforms: Payload<ClientTransforms>
  },
  user: {
    someClientStateUpdated: Payload<DataAndReason<ReturnType<UserClient['getPublicState']>>>,
    myStateUpdated: Payload<DataAndReason<ReturnType<UserClient['getPublicState']>>>,
  }
}
export type UserClientEventMap = EventMapAdditions & BaseClientEventMap

/**
 * @class
 * This class represents the backend state of a user client connection.
 */
export class UserClient extends BaseClient {
  constructor(...args: ConstructorParameters<typeof BaseClient>){
    super(...args);
    log.info(`Creating user client ${this.username} (${this.connectionId})`);
    log.debug('dbData:', this.dbData.value);

    effect(() => {
      if(!this.vrSpace) return;
      this.publicProducers;
      this.vrSpace._notifyStateUpdated('a client updated producers');
    });
  }
  readonly clientType = 'client' as const satisfies ClientType;

  vrSpaceId?: VrSpaceId;

  transform: ClientTransform | undefined;

  // sneaky hack so we can share the instance between base, user and senderclient but different intellisense.
  declare eventSender: EventSender<MyWebsocketType, UserClientEventMap>;

  unload() {
    log.info(`unloading user client ${ this.username } ${this.connectionId} `);
    super.unload();
    this.leaveCurrentStream();
  }

  private currentCameraId?: CameraId;
  /**
   * **WARNING**: You should never need to call this function, since the camera instance calls this for you when it adds a client to itself.
   */
  _setCamera(cameraId?: CameraId){
    this.currentCameraId = cameraId;
  }
  get currentCamera() {
    if(!this.currentCameraId) return undefined;
    if(!this.venue){
      throw Error('Something is really off! currentCameraId is set but client isnt in a venue! Invalid state!');
    }
    const camera = this.venue.cameras.get(this.currentCameraId);
    if(!camera){
      throw Error('client had an assigned currentCameraId but that camera was not found in venue. Invalid state!');
    }
    return camera;
  }

  /**
   * **WARNING**: You should never need to call this function in "user land", since the vrSpace instance calls this for you when it adds a client to itself.
   */
  _setVrSpace(vrSpaceId: VrSpaceId | undefined) {
    this.vrSpaceId = vrSpaceId;
  }

  get vrSpace() {
    try {
      if (!this.vrSpaceId) return undefined;
      // return getVenue(this.venueId);
      return VrSpace.getVrSpace(this.vrSpaceId);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  getPublicState(){
    return {
      ...super.getPublicState(),
      clientType: this.clientType,
      transform: this.transform,
      currentCameraId: this.currentCamera?.cameraId,
      isInVrSpace: !!this.vrSpace,
    };
  }

  async loadPrismaDataAndNotifySelf(reason?: string) {
    const updatedDbUser = await loadUserDBData(this.userId);
    this.dbData.value = updatedDbUser;
    this._onClientStateUpdated(reason);
  }

  _onClientStateUpdated(reason?: string) {
    if (!this.ws) {
      log.info('skipped emitting to client because socket was undefined');
      return;
    }
    log.info(`notyfying myStateUpdated for ${this.username} (${this.connectionId}) to itself`);
    // we emit the new clientstate to the client itself.
    this.eventSender.user.myStateUpdated({ data: this.getPublicState(), reason });
  }

  async joinStream(streamId: StreamId) {
    this.leaveCurrentStream();
    // const venue = await Venue.getPublicVenue(venueId, this.userId);
    const stream = Venue.getStream(streamId);
    stream.addClient(this);
    // this.sendTransport = await venue.createWebRtcTransport();
    // this.receiveTransport = await venue.createWebRtcTransport();
    this._onClientStateUpdated('user client joined stream');
    return stream.getPublicState();
  }

  leaveCurrentStream() {
    if(!this.venue) {
      return false;
      // throw Error('cant leave a venue if you are not in one!');
    }
    // super._onRemovedFromVenue();
    this.leaveCurrentCamera();
    this.venue.removeClient(this);
    this._onClientStateUpdated('user client left a stream');
    return true;
  }

  /**
   * joins the given vrSpace, trying to load/instantiate it if needed
   */
  async enterVrSpace(vrSpaceId: VrSpaceId) {
    if (this.venue) {
      this.leaveCurrentStream();
    }
    this.leaveCurrentVrSpace();
    let vrSpace = VrSpace.getVrSpace(vrSpaceId);
    if (!vrSpace) {
      log.info(`vrSpace (${vrSpaceId}) wasnt loaded yet. loading it now.`);
      vrSpace = await VrSpace.loadVrSpace(vrSpaceId);
    }
    vrSpace.addClient(this);
    this._onClientStateUpdated('user client joined vrSpace');
  }

  leaveCurrentVrSpace() {
    if (!this.vrSpace) {
      log.warn('tried to leave a vrSpace when not in one');
      return;
    }
    this.vrSpace.removeClient(this)
    this._onClientStateUpdated('user client left vrSpace');
  }

  joinCamera(cameraId: CameraId) {
    const camera = this.venue?.cameras.get(cameraId);
    if(!camera){
      throw Error('no camera with that id exist in the venue');
    }
    camera.addClient(this);
    this._onClientStateUpdated('user client joined camera');
  }

  /**
   * @returns boolean indicating if the client was in a camera in the first place. Calling this function when not in a camera will simply do nothing and return false.
   */
  leaveCurrentCamera() {
    if(!this.currentCamera){
      return false;
    }
    const wasRemoved = this.currentCamera.removeClient(this);
    this._onClientStateUpdated('user client left camera');
    return wasRemoved;
  }
}
