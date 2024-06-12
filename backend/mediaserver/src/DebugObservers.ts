import { Log } from 'debug-level';
const log = new Log('Stats:Instances');
process.env.DEBUG = 'Stats:Instances*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { Stream } from './classes/InternalClasses.js';

// @ts-expect-error: We allow reading private field here
type venueDict = typeof Stream.venues extends Map<infer K, any> ? Record<K, { clients: number, senders: number }> : never

export const printClassInstances = (clientList: Map<any, any>) => {
  const totalNrOf = {
    nrOfClients: clientList.size,
    nrOfVenues: 0,
    venueClients: {} as venueDict    // cameras: 0,
  };

  // @ts-expect-error: In ooonly this specific case we want to ignore the private field (streams). But never elsewhere
  for (const [venueKey, venue] of Stream.streams.entries()) {
    totalNrOf.nrOfVenues++;
    totalNrOf.venueClients[venueKey] = {
      clients: 0,
      senders: 0,
    };

    // @ts-expect-error: In ooonly this specific case we want to ignore the private field (clients). But never elsewhere
    for(const [clientKey, client] of venue.clients.entries()) {
      totalNrOf.venueClients[venueKey].clients++;
    }
    // @ts-expect-error: In ooonly this specific case we want to ignore the private field (senderClients). But never elsewhere
    for(const [senderKey, client] of venue.senderClients.entries()) {
      totalNrOf.venueClients[venueKey].senders++;
    }
  }

  log.info('totalNrOf:', totalNrOf);
};