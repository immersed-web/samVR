import { JwtUserData, UserId } from 'schemas'

declare module 'express-session' {
  interface SessionData {
    userId: UserId
    user: JwtUserData
  }
}