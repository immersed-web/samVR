import { JwtPayload } from 'schemas'

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload
  }
}

