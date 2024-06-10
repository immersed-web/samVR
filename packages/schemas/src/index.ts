import { z } from 'zod';
import type { JwtPayload as JwtShapeFromLib } from 'jsonwebtoken'
// import { Role, Venue, VirtualSpace3DModel, Visibility, Camera, CameraType as PrismaCameraType, Prisma, ModelFileFormat } from "database";
import * as schema from 'database/schema';
import { createInsertSchema } from 'drizzle-zod';

// const PlacedObjectInsertSchema = createInsertSchema(schema.placedObjects)

type RemoveIndex<T> = {
  [ K in keyof T as string extends K ? never : number extends K ? never : K ] : T[K]
};

type JWTDefaultPayload = RemoveIndex<JwtShapeFromLib>

type Implements<Model> = {
  [key in keyof Model]-?: undefined extends Model[key]
    ? null extends Model[key]
      ? z.ZodNullableType<z.ZodOptionalType<z.ZodType<Model[key]>>>
      : z.ZodOptionalType<z.ZodType<Model[key]>>
    : null extends Model[key]
    ? z.ZodNullableType<z.ZodType<Model[key]>>
    : z.ZodType<Model[key]>;
};

function implement<Model = never>() {
  return {
    with: <
      Schema extends Implements<Model> & {
        [unknownKey in Exclude<keyof Schema, keyof Model>]: never;
      }
    >(
      schema: Schema
    ) => z.object(schema),
  };
}

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & unknown;

// const literalSchema = z.union([z.string(), z.number(), z.boolean()]);
// type Literal = z.infer<typeof literalSchema>;
// type Json = Literal | { [key: string]: Json } | Json[];
// const JsonSchema: z.ZodType<JSONDB> = z.lazy(() =>
//   z.union([literalSchema, z.array(JsonSchema), z.record(JsonSchema)])
// );

// type NullableJsonInput = Prisma.JsonValue | null | 'JsonNull' | 'DbNull' | Prisma.NullTypes.DbNull | Prisma.NullTypes.JsonNull;

// const transformJsonNull = (v?: NullableJsonInput) => {
//   if (!v || v === 'DbNull') return Prisma.DbNull;
//   if (v === 'JsonNull') return Prisma.JsonNull;
//   return v;
// };

// const JsonValueSchema: z.ZodType<Prisma.JsonValue> = z.union([
//   z.string(),
//   z.number(),
//   z.boolean(),
//   z.lazy(() => z.array(JsonValueSchema)),
//   z.lazy(() => z.record(JsonValueSchema)),
// ]);

// const NullableJsonValueSchema = z
//   .union([JsonValueSchema, z.literal('DbNull'), z.literal('JsonNull')])
//   .nullable()
//   .transform((v) => transformJsonNull(v));

// const InputJsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.union([
//   z.string(),
//   z.number(),
//   z.boolean(),
//   z.lazy(() => z.array(InputJsonValueSchema.nullable())),
//   z.lazy(() => z.record(InputJsonValueSchema.nullable())),
// ]);

// const NullableJsonNullValueInputSchema = z.enum(['DbNull','JsonNull',]).transform((v) => transformJsonNull(v));

const jwtDefaultPayload = implement<JWTDefaultPayload>().with({
  aud: z.string().optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
  iss: z.string().optional(),
  jti: z.string().optional(),
  nbf: z.number().optional(),
  sub: z.string().optional(),
})

export const roleHierarchy = schema.RoleEnum.enumValues;
// TODO: I would really prefer to infer a const literal tuple from the prisma enum.
// That is. Could we in some way convert/extract a literal tuple from the prisma type and then use z.enum() on it directly
// Then we could use that extracted literal tuple from prisma instead of defining it manually here. This is redundant and we need to keep them in sync
// export const roleHierarchy = (['gunnar', 'superadmin', 'admin', 'moderator', 'sender', 'user', 'guest'] as const) satisfies Readonly<Role[]>;

export function throwIfUnauthorized(role: UserRole, minimumUserRole: UserRole) {
  if(!hasAtLeastSecurityLevel(role, minimumUserRole)){
    throw new Error('Unauthorized! You fool!');
  }
}

export function hasAtLeastSecurityLevel(role: UserRole | undefined, minimumUserRole: UserRole) {
  if(!role){
    // return false;
    throw new Error('no userRole provided for auth check!');
  }
  if(!minimumUserRole) {
    throw new Error('no minimum userRole provided for auth check!');
  }
  const clientSecurityLevel = roleHierarchy.indexOf(role);
  if(clientSecurityLevel < 0) throw Error('invalid role provided');
  const minimumRoleLevel = roleHierarchy.indexOf(minimumUserRole);
  if(minimumRoleLevel < 0) throw Error('invalid minimum role provided');

  return clientSecurityLevel <= minimumRoleLevel
}

// type RoleSet = Set<Role>;
// const roles: Set<Role> = new Set(['gunnar', 'superadmin', 'admin', 'moderator', 'user', 'guest']);
// const arr = Array.from(roles);
// type RoleEnumToZod = toZod<EnumFromRoleUnion>

// type EnumFromRoleUnion = {
//   [k in Role]: k
// };

// const zodifiedRoleEnun: toZod<EnumFromRoleUnion> = z.object({
//   gunnar: z.literal('gunnar'),
//   superadmin: z.literal('superadmin'),
//   admin: z.literal('admin'),
//   moderator: z.literal('moderator'),
//   user: z.literal('user'),
//   guest: z.literal('guest'),
// });

// type InferredRole = z.TypeOf<typeof zodifiedRoleEnun>;
//
// const UserRoleSchema = z.enum(possibleUserRoles);
export const UserRoleSchema = z.enum(roleHierarchy);
export type UserRole = z.TypeOf<typeof UserRoleSchema>;

export const VisibilitySchema = z.enum(schema.VisibilityEnum.enumValues);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const AssetTypeSchema = z.enum(schema.AssetTypeEnum.enumValues);
export type AssetType = z.infer<typeof AssetTypeSchema>;

// export type { Visibility } from 'database'

const timestampKeys = {
  createdAt: true, updatedAt: true,
} as const

const optionalReason = z.object({
  reason: z.string().optional(),
});

//Here we are creating Opaque type for the different types of id's. This is to prevent acidentally using ids for the wrong type of object. No foot guns in this house, no no no :)
export const UuidSchema = z.string().uuid();
export type Uuid = z.TypeOf<typeof UuidSchema>;

export const ConnectionIdSchema = UuidSchema.brand<'ConnectionId'>();
export type ConnectionId = z.TypeOf<typeof ConnectionIdSchema>;

export const UserIdSchema = UuidSchema.brand<'UserId'>();
export type UserId = z.TypeOf<typeof UserIdSchema>;

export const StreamIdSchema = UuidSchema.brand<'StreamId'>();
export type StreamId = z.TypeOf<typeof StreamIdSchema>;

export const CameraIdSchema = UuidSchema.brand<'CameraId'>();
export type CameraId = z.TypeOf<typeof CameraIdSchema>;

export const AssetIdSchema = UuidSchema.brand<'AssetId'>();
export type AssetId = z.TypeOf<typeof AssetIdSchema>;

export const VrSpaceIdSchema = UuidSchema.brand<'VrSpaceId'>();
export type VrSpaceId = z.TypeOf<typeof VrSpaceIdSchema>;

export const PlacementIdSchema = UuidSchema.brand<'PlacementId'>();
export type PlacementId = z.TypeOf<typeof PlacementIdSchema>;

export const SenderIdSchema = UuidSchema.brand<'SenderId'>();
export type SenderId = z.TypeOf<typeof SenderIdSchema>;

export type StreamListInfo = Prettify<Pick<typeof schema.streams.$inferSelect,
  'streamId'
  | 'name'
  | 'ownerUserId'
  | 'visibility'
  | 'streamAutoStart'
  | 'streamStartTime'
  | 'streamManuallyStarted'
  | 'streamManuallyEnded'
  >>

export const StreamInsertSchema = createInsertSchema(schema.streams, {
  streamId: StreamIdSchema.optional(),
  ownerUserId: UserIdSchema,
  // vrSpaceId: VrSpaceIdSchema.optional(),
  mainCameraId: CameraIdSchema.optional(),
})
  .omit(timestampKeys)
  .merge(optionalReason);
export type StreamInsert = z.TypeOf<typeof StreamInsertSchema>;

// TODO: Refactor so we always use insert schemas instead of special schema for update vs create 
export const StreamUpdateSchema = StreamInsertSchema.omit({ streamId: true }).partial();
export type StreamUpdate = z.TypeOf<typeof StreamUpdateSchema>;


export const CameraPortalInsertSchema = createInsertSchema(schema.cameraPortals, {
  fromCameraId: CameraIdSchema,
  toCameraId: CameraIdSchema,
})
  .omit(timestampKeys)
  .merge(optionalReason);
export type CameraPortalInsert = z.TypeOf<typeof CameraPortalInsertSchema>;


export const CameraInsertSchema = createInsertSchema(schema.cameras, {
  cameraId: CameraIdSchema.optional(),
  streamId: StreamIdSchema,
  senderId: SenderIdSchema.optional()
})
  .omit(timestampKeys)
  .merge(optionalReason);
export type CameraInsert = z.TypeOf<typeof CameraInsertSchema>;
export const CameraUpdateSchema = CameraInsertSchema.partial().required({ cameraId: true });
export type CameraUpdate = z.TypeOf<typeof CameraUpdateSchema>;

// type CameraUpdatePayload = Partial<Pick<Prisma.CameraUpdateInput,
//   'name'
//   | 'fovStart'
//   | 'fovEnd'
//   | 'cameraType'
//   | 'orientation'
//   | 'viewOriginX'
//   | 'viewOriginY'
//   | 'settings'
//   >>;



// const CameraUpdatePayloadSchema = implement<CameraUpdatePayload>().with({
//     name: z.string().optional(),
//     cameraType: z.enum(['panoramic360', 'normal']).optional(),
//     viewOriginX: z.number().optional(),
//     viewOriginY: z.number().optional(),
//     fovStart: z.number().optional(),
//     fovEnd: z.number().optional(),
//     orientation: z.number().optional(),
//     // settings: JsonSchema.optional().nullable(),
//     settings: InputJsonValueSchema.optional(),
//     // settings: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
// })

// export const CameraUpdateSchema = z.object({
//   cameraId: CameraIdSchema,
//   data: CameraUpdatePayloadSchema,
//   reason: z.string().optional(),
// });
// export type CameraUpdate = z.TypeOf<typeof CameraUpdateSchema>

export const CameraFOVUpdateSchema = z.object({
  cameraId: CameraIdSchema,
  fovStart: z.number(),
  fovEnd: z.number()
})
export type CameraFOVUpdate = z.TypeOf<typeof CameraFOVUpdateSchema>;

export const JwtUserDataSchema = z.object({
  userId: UserIdSchema,
  username: z.string(),
  role: UserRoleSchema,
})
export type JwtUserData = z.TypeOf<typeof JwtUserDataSchema>;

export const JwtPayloadSchema = jwtDefaultPayload.merge(JwtUserDataSchema)
export type JwtPayload = z.TypeOf<typeof JwtPayloadSchema>;

const TransformSchema = z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    orientation: z.tuple([z.number(), z.number(), z.number(), z.number()])
  });
export type Transform = z.TypeOf<typeof TransformSchema>;

export const ClientTransformSchema = z.object({
  head: TransformSchema,
  leftHand: TransformSchema.optional(),
  rightHand: TransformSchema.optional(),
})
export type ClientTransform = z.TypeOf<typeof ClientTransformSchema>;
export type ClientTransforms = Record<ConnectionId, ClientTransform>;

// export const ClientInfoSchema = z.object({
//   userId: UserIdSchema,
//   role: UserRoleSchema,
//   position: z.optional(ClientTransformSchema)
// })
// export type ClientInfo = z.TypeOf<typeof ClientInfoSchema>;

export const ClientTypeSchema = z.union([z.literal('client'), z.literal('sender')]);
export type ClientType = z.TypeOf<typeof ClientTypeSchema>;
