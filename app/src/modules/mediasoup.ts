import {Device, types as soupTypes} from 'mediasoup-client';
import type { ProducerId, TransportId, CreateProducerPayload } from 'schemas/mediasoup';

import { clientOrThrow } from './trpcClient';


type ConnectTransportFunction = (data: {transportId: TransportId, dtlsParameters: soupTypes.DtlsParameters}) => Promise<void>
type CreateProducerFunction = (data: CreateProducerPayload) => Promise<ProducerId>

export type ProduceAppData = Pick<CreateProducerPayload, 'producerId' | 'producerInfo'>

export function attachTransportEvents<Dir extends 'recv'>(transport: soupTypes.Transport, connectTransport: ConnectTransportFunction): void;
export function attachTransportEvents<Dir extends 'send'>(transport: soupTypes.Transport, connectTransport: ConnectTransportFunction, createProducer: CreateProducerFunction): void;
export function attachTransportEvents(transport: soupTypes.Transport, connectTransport: ConnectTransportFunction, createProducer?: CreateProducerFunction) {
  transport.on('connect', async ({dtlsParameters}, callback, errback) => {
    console.log('transport connect event trigered!');
    try{
      await connectTransport({transportId: transport.id as TransportId, dtlsParameters});
      callback();
      return;
    } catch(e) {
      errback(e as Error);
    }
  });

  if (transport.direction === 'send') {
    transport.on('produce', async ({
      kind,
      rtpParameters,
      appData,
    }, callback, errorback) => {
      console.log('transport produce event triggered!', {kind, rtpParameters, appData});
      try {
        const { producerInfo, producerId } = appData as ProduceAppData;

        const createdProducerId = await createProducer!({transportId: transport.id as TransportId, producerId, kind, rtpParameters, producerInfo});
        callback({ id: createdProducerId });
        return;
      } catch (err) {
        errorback(err as Error);
      }
    });
  }

  const timeoutDuration = 4000;
  let restartICETimeout: ReturnType<typeof setTimeout> | undefined = undefined;
  transport.on('connectionstatechange', (state) => {
    console.log(`transport (${transport.id}) connection state changed to: `, state);
    switch (state) {
      case 'connecting':
        break;
      case 'connected':
        if(restartICETimeout) clearTimeout(restartICETimeout);
        break;
      case 'disconnected':
        // console.error('transport connectionstatechange disconnected');
        // console.time('disconnected');
        restartICETimeout = setTimeout(async () => {
          console.warn(`disconnected for ${timeoutDuration}ms. Will try to restart ICE`);
          if(transport.direction === 'send'){
            const iceParameters = await clientOrThrow.value.soup.restartICEforSendTransport.query();
            transport.restartIce({iceParameters});
          } else {
            const iceParameters = await clientOrThrow.value.soup.restartICEforReceiveTransport.query();
            transport.restartIce({iceParameters});
          }
        }, timeoutDuration);
        break;
      case 'failed':
        // console.timeEnd('disconnected');
        console.error('transport connectionstatechange failed');
        transport.close();
        break;
      default:
        break;
    }
  });
}
