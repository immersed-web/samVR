import { Log } from 'debug-level';
const log = new Log('SoupUtils');
process.env.DEBUG = 'SoupUtils*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { types as soupTypes } from 'mediasoup';
import mediasoupConfig from 'soupConfig.js';


export async function createWebRtcTransport(router: soupTypes.Router) {
  const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);

  if (mediasoupConfig.maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(mediasoupConfig.maxIncomingBitrate);
    } catch (e) {
      log.error('failed to set maximum incoming bitrate for webRtcTransport');
    }
  }

  transport.on('dtlsstatechange', (dtlsState: soupTypes.DtlsState) => {
    if (dtlsState === 'closed') {
      log.info('---transport close--- transport with id ' + transport.id + ' closed');
      transport.close();
    }
    if (dtlsState === 'failed') {
      log.info('---transport FAILED--- transport with id ' + transport.id + ' failed');
    }
  });

  return transport;
}