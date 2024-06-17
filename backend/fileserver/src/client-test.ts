import { HttpStatus } from 'http-status-ts';
import type { AppType } from '.'
import { InferResponseType, hc } from 'hono/client'

const client = hc<AppType>('http://localhost:3000');


const res = await client.upload.$post({
  form: {
    file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
    assetType: 'document'
  }
});
if (res.ok) {
  const data = await res.json()
}
else {

}

// const fetchedAsset = await client.file[':filename'].$get({
//   param: {
//     filename: 'hello.txt'
//   }
// })
// const res2 = await assetRoute.$get({
//   param: {
//     assetId: '1'
//   }
// })
// if (res2.ok) {
//   const data = await res2.json();
// }