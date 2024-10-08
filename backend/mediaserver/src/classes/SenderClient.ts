import { BaseClient, BaseClientEventMap, DataAndReason, Stream } from './InternalClasses.js';

import { Log } from 'debug-level';
import { CameraId, ClientType, SenderId, SenderIdSchema, StreamId } from 'schemas';
import { randomUUID } from 'crypto';
import { EventSender, Payload } from 'ts-event-bridge/sender';
import { MyWebsocketType } from 'index.js';

const log = new Log('SenderClient');
process.env.DEBUG = 'SenderClient*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

type SenderConstructorInput = ConstructorParameters<typeof BaseClient>[0] & {senderId?: SenderId};

type EventMapAdditions = {
  sender: {
    myStateUpdated: Payload<DataAndReason<ReturnType<SenderClient['getPublicState']>>>
  }
}

export type SenderClientEventMap = BaseClientEventMap & EventMapAdditions

export class SenderClient extends BaseClient{
  constructor({senderId = SenderIdSchema.parse(randomUUID()), ...args}: SenderConstructorInput){
    super(args);
    this.senderId = senderId;
    log.info(`Creating sender client ${this.username} (${this.connectionId})`);
    log.debug('prismaData:', this.dbData);
  }
  readonly clientType = 'sender' as const satisfies ClientType;
  senderId: SenderId;

  get currentRouter() {
    if (this.stream) return this.stream.router;
    return undefined;
  }

  private cameraId?: CameraId;
  /**
   * **WARNING**: You should never need to call this function, since the camera instance calls this for you when it adds the sender to itself.
   */
  _setCamera(cameraId?: CameraId){
    this.cameraId = cameraId;
    this._notifyStateUpdated('attached/detached to camera');
  }
  get camera() {
    if(!this.cameraId) return undefined;
    if (!this.stream) {
      throw Error('Something is really off! currentCameraId is set but sender isnt in a stream! Invalid state!');
    }
    const camera = this.stream.cameras.get(this.cameraId);
    if(!camera){
      throw Error('client had an assigned currentCameraId but that camera was not found in stream. Invalid state!');
    }
    return camera;
  }

  declare eventSender: EventSender<MyWebsocketType, SenderClientEventMap>;

  getPublicState(){
    const { senderId, cameraId, clientType } = this;
    return {
      ...super.getPublicState(),
      senderId,
      cameraId,
      clientType,
    };
  }

  _notifyStateUpdated(reason?: string) {
    if(!this.connectionId){
      log.info('skipped emitting to client because socket was already closed');
      return;
    }
    log.info(`notifying senderState (${reason}) for ${this.username} (${this.connectionId}) to itself`);
    this.eventSender.sender.myStateUpdated({ data: this.getPublicState(), reason });
  }

  unload() {
    log.info(`unloading sender client ${ this.username } ${this.connectionId} `);
    super.unload();
    this.leaveCurrentStream();
  }

  async joinStream(streamId: StreamId) {
    this.leaveCurrentStream();
    const stream = Stream.getStream(streamId);
    stream.addClient(this);
    this._notifyStateUpdated('sender client joined stream');
    return stream.getPublicState();
  }

  leaveCurrentStream() {
    if (!this.stream) {
      return false;
    }
    // super._onRemovedFromVenue();
    // this.teardownMediasoupObjects();
    this.stream.removeClient(this);
    return true;
  }
}
