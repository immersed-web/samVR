import { ZodLiteral, ZodObject, ZodSchema, ZodUnion, ZodUnionOptions, z } from 'zod';
import type { JwtPayload as JwtShapeFromLib } from 'jsonwebtoken'
// import { Role, Venue, VirtualSpace3DModel, Visibility, Camera, CameraType as PrismaCameraType, Prisma, ModelFileFormat } from "database";
import * as schema from 'database/schema';
import { createInsertSchema, createSelectSchema, jsonSchema } from 'drizzle-zod';

export type Json = z.TypeOf<typeof jsonSchema>

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
  if (!hasAtLeastSecurityRole(role, minimumUserRole)) {
    throw new Error('Unauthorized! You fool!');
  }
}

export function hasAtLeastSecurityRole(role: UserRole | undefined, minimumUserRole: UserRole) {
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

export const insertablePermissionHierarchy = schema.PermissionLevel.enumValues;
export const returnedPermissionHierarchy = ['owner', ...insertablePermissionHierarchy, undefined] as const;
type ReturnedPermissionLevel = typeof returnedPermissionHierarchy[number];
export function hasAtLeastPermissionLevel(userPermissionLevel: ReturnedPermissionLevel, requiredPermissionLevel: Exclude<ReturnedPermissionLevel, undefined>) {
  if (!userPermissionLevel) {
    console.warn('undefined userPermissionLevel provided for permission check!');
    return false;
    // throw new Error('no userPermissionLevel provided for permission check!');
  }
  if (!requiredPermissionLevel) {
    throw new Error('no requiredPermissionLevel provided for permission check!');
  }

  const userPermissionLevelIdx = returnedPermissionHierarchy.indexOf(userPermissionLevel);
  if (userPermissionLevelIdx < 0) throw Error('invalid userPermissionLevel provided');
  const requiredPermissionLevelIdx = returnedPermissionHierarchy.indexOf(requiredPermissionLevel);
  if (requiredPermissionLevelIdx < 0) throw Error('invalid requiredPermissionLevel provided');
  return userPermissionLevelIdx <= requiredPermissionLevelIdx;
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

export const maxFileSize = 50 * 1024 * 1024;
export const maxFileSizeSchema = z.number().max(maxFileSize);

const Vector2TupleSchema = z.tuple([z.number(), z.number()]);
const Vector3TupleSchema = z.tuple([z.number(), z.number(), z.number()]);
const Vector4TupleSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);


export const assetTypesToExtensionsMap = {
  video: ['mp4', 'mkv', 'mov', 'webm'],
  image: ['png', 'jpg', 'jpeg', 'webp'],
  document: ['pdf'],
  model: ['glb'],
  navmesh: ['glb'],
} as const satisfies Record<AssetType, string[]>

export type AssetAframeTagname = typeof extensionsToAframeTagsMap[AllFileExtensions];

export const extensionsToAframeTagsMap = {
  // 3d models
  glb: 'a-gltf-model',
  // images
  png: 'a-image',
  jpg: 'a-image',
  jpeg: 'a-image',
  webp: 'a-image',
  // videos
  mp4: 'a-video',
  mkv: 'a-video',
  mov: 'a-video',
  webm: 'a-video',
  // documents
  pdf: 'PdfEntity', // PascalCase because vue component
} as const satisfies Partial<Record<AllFileExtensions, string>>

// export const assetTypesToAframeTagsMap = {
//   document: 'PdfEntity',
//   image: 'a-image',
//   model: 'a-entity',
//   navmesh: 'a-entity',
//   video: 'a-video'
// } as const satisfies Record<AssetType, string>;

// function concat<T extends unknown[], U extends unknown[]>(t: [...T], u: [...U]): [...T, ...U] {
//   return [...t, ...u];
// }

// function buildList<T extends AssetType>(t: T[]): [typeof assetTypesToExtensionsMap[T][number]] {
//   return t.reduce<[typeof assetTypesToExtensionsMap[T][number]]>((acc, curr) => {
//     return acc.push(...assetTypesToExtensionsMap[curr]);
//   },[]);
// }

// const s = buildList(['image', 'video']);

// const schem = z.enum(s)

// const combList = concat(assetTypesToExtensionsMap['image'], assetTypesToExtensionsMap['video']);

type AcceptedExtensionsArray<T extends AssetType = AssetType> = [typeof assetTypesToExtensionsMap[T][number]]
// type AllFileExtensions = AcceptedExtensionsArray[number]

export const AllFileExtensionsSchema = createFileExtensionSchema(AssetTypeSchema.options);
export type AllFileExtensions = z.TypeOf<typeof AllFileExtensionsSchema>;
// type Test = AcceptedExtensions<'image' | 'video'>

// function test<T extends AssetType[]>(assetType: T) {
//   const list = ['glb'] as Prettify<AcceptedExtensions<T[number]>>
//   // return z.enum(list);
//   return list
// }

// const tt = test(['image', 'video'])

export function assetTypeListToExtensionList<T extends AssetType>(assetTypes: T | T[]) {
  if (!(assetTypes instanceof Array)) {
    assetTypes = [assetTypes];
  }
  // @ts-ignore
  const extensionList: AcceptedExtensionsArray<T> = assetTypes.reduce<AcceptedExtensionsArray<T>>((acc, assetType) => {
    return [...acc, ...assetTypesToExtensionsMap[assetType]];
  }, []);
  return extensionList;
}

/**
 * Will try to match an assetType for the provided extension (without the dot)
 * @param extension file extension without the dot (examples: pdf, glb or png)
 * @param acceptedAssetTypes optional assetType or list of accepted assetTypes. If not provied, extension will be matched against all assetTypes
 *
 */
export function getAssetTypeFromExtension(extension: string, acceptedAssetTypes?: AssetType | AssetType[]) {
  if (acceptedAssetTypes === undefined) {
    acceptedAssetTypes = Object.keys(assetTypesToExtensionsMap) as AssetType[]
  }

  if (!(acceptedAssetTypes instanceof Array)) {
    acceptedAssetTypes = [acceptedAssetTypes]
  }
  for (const assetType of acceptedAssetTypes) {
    // @ts-ignore
    if (assetTypesToExtensionsMap[assetType].includes(extension)) {
      return assetType;
    }
  }
  console.warn('failed to match extension to a valid asset type');
  return undefined
}



export function createFileExtensionSchema<T extends AssetType>(assetTypes: T | T[]) {
  const extensionList = assetTypeListToExtensionList(assetTypes);
  // if (!(assetTypes instanceof Array)) {
  //   assetTypes = [assetTypes];
  // }
  // // @ts-ignore
  // const extensionList: AcceptedExtensions<T> = assetTypes.reduce<AcceptedExtensions<T>>((acc, assetType) => {
  //   return [...acc, ...assetTypesToExtensionsMap[assetType]];
  // }, []);
  // const extensionList: typeof assetTypesToExtensionsMap[T] = assetTypesToExtensionsMap[assetTypes];
  return z.enum(extensionList)//.transform((ext) => ext.toLowerCase());
}

// const imageVideoSchema = createFileExtensionSchema(['image', 'video']);

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

export const PlacedObjectIdSchema = UuidSchema.brand<'PlacedObjectId'>();
export type PlacedObjectId = z.TypeOf<typeof PlacedObjectIdSchema>;

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

export const VrSpaceSelectSchema = createSelectSchema(schema.vrSpaces, {
  vrSpaceId: VrSpaceIdSchema,
  worldModelAssetId: AssetIdSchema,
  navMeshAssetId: AssetIdSchema.optional(),
  panoramicPreviewAssetId: AssetIdSchema.optional(),
})

export type VrSpaceSelect = z.TypeOf<typeof VrSpaceSelectSchema>;

export const VrSpaceInserSchema = createInsertSchema(schema.vrSpaces, {
  vrSpaceId: VrSpaceIdSchema.optional(),
  worldModelAssetId: AssetIdSchema,
  navMeshAssetId: AssetIdSchema.optional(),
  panoramicPreviewAssetId: AssetIdSchema.optional(),
})
  .omit(timestampKeys)
  .omit({ ownerUserId: true })
  .merge(optionalReason);


export type VrSpaceInsert = z.TypeOf<typeof VrSpaceInserSchema>;
export const VrSpaceUpdateSchema = VrSpaceInserSchema.partial().required({ vrSpaceId: true });
export type VrSpaceUpdate = z.TypeOf<typeof VrSpaceUpdateSchema>;

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

export const PermissionInsertSchema = createInsertSchema(schema.permissions, {
  userId: UserIdSchema,
  targetId: z.union([StreamIdSchema, VrSpaceIdSchema])
})
type PermissionInsert = z.TypeOf<typeof PermissionInsertSchema>;

const PermissionSelectSchema = createSelectSchema(schema.permissions, {
  targetId: z.union([StreamIdSchema, VrSpaceIdSchema]),
  userId: UserIdSchema,
})
type PermissionSelect = z.TypeOf<typeof PermissionSelectSchema>;

export const PermissionDeleteSchema = createSelectSchema(schema.permissions, {
  userId: UserIdSchema,
  targetId: z.union([StreamIdSchema, VrSpaceIdSchema]),
}).pick({ userId: true, targetId: true, targetType: true });
type PermissionDelete = z.TypeOf<typeof PermissionDeleteSchema>;

const StreamPermissionSelectSchema = PermissionSelectSchema.extend({ targetType: z.literal('stream'), targetId: StreamIdSchema })
type StreamPermission = z.TypeOf<typeof StreamPermissionSelectSchema>
export function isStreamPermission(dbPermission: PermissionSelect): dbPermission is StreamPermission {
  return dbPermission.targetType === 'stream';
}

const VrSpacePermissionSelectSchema = PermissionSelectSchema.extend({ targetType: z.literal('vrSpace'), targetId: VrSpaceIdSchema })
type VrSpacePermission = z.TypeOf<typeof VrSpacePermissionSelectSchema>
export function isVrSpacePermission(dbPermission: PermissionSelect): dbPermission is VrSpacePermission {
  return dbPermission.targetType === 'vrSpace';
}

export const PlacedObjectInsertSchema = createInsertSchema(schema.placedObjects, {
  placedObjectId: PlacedObjectIdSchema.optional(),
  vrSpaceId: VrSpaceIdSchema,
  objectId: z.union([AssetIdSchema, VrSpaceIdSchema, StreamIdSchema]),
  position: Vector3TupleSchema,
  orientation: Vector4TupleSchema,
  scale: Vector3TupleSchema,
})
  .omit(timestampKeys)
  .merge(optionalReason);
export type PlacedObjectInsert = z.TypeOf<typeof PlacedObjectInsertSchema>;
export type PlacedObject = Omit<PlacedObjectInsert, 'placedObjectId'> & { placedObjectId: PlacedObjectId };
// type tt = PlacedObjectInsert['orientation'];
// type rr = PlacedObjectInsert['scale'];
// type pp = PlacedObjectInsert['position'];

const AssetSelectSchema = createSelectSchema(schema.assets, {
  assetFileExtension: AllFileExtensionsSchema,
  assetId: AssetIdSchema,
  ownerUserId: UserIdSchema,
})
export type Asset = z.TypeOf<typeof AssetSelectSchema>;

export const JwtUserDataSchema = z.object({
  userId: UserIdSchema,
  username: z.string(),
  role: UserRoleSchema,
})
export type JwtUserData = z.TypeOf<typeof JwtUserDataSchema>;

export const JwtPayloadSchema = jwtDefaultPayload.merge(JwtUserDataSchema)
export type JwtPayload = z.TypeOf<typeof JwtPayloadSchema>;

export const defaultHeightOverGround = 1.7;

const TransformSchema = z.discriminatedUnion('active', [
  z.object({
    active: z.literal(true),
    position: Vector3TupleSchema,
    rotation: Vector4TupleSchema,
  }),
  z.object({
    active: z.literal(false),
  }),
]);
export type MaybeTransform = z.TypeOf<typeof TransformSchema>;
export type ActiveTransform = Extract<MaybeTransform, { active: true }>;

const LaserPointerSchema = z.discriminatedUnion('active', [
  z.object({
    active: z.literal(false),
  }),
  z.object({
    active: z.literal(true),
    position: Vector3TupleSchema,
    directionVector: Vector3TupleSchema,
    // startPosition: Vector3TupleSchema,
    // endPosition: Vector3TupleSchema
  }),
])

const EmojiSchema = z.discriminatedUnion('active', [
  z.object({
    active: z.literal(false),
  }),
  z.object({
    active: z.literal(true),
    coords: Vector2TupleSchema,
  }),
])

export const ClientRealtimeDataSchema = z.object({
  head: TransformSchema,
  leftHand: TransformSchema.optional(),
  rightHand: TransformSchema.optional(),
  laserPointer: LaserPointerSchema.optional(),
  emoji: EmojiSchema.optional(),
})
export type ClientRealtimeData = z.TypeOf<typeof ClientRealtimeDataSchema>;
export type ClientsRealtimeData = Record<ConnectionId, ClientRealtimeData>;

// const avatarAssets = {
//   hands: ['hands_basic_left'],
//   heads: ['heads_basic'],
//   torsos: ['torsos_basic_male'],
//   eyes: ['eyes_huge', 'eyes_relaxed', 'eyes_cool', 'eyes_kind', 'eyes_round', 'eyes_npc'],
//   eyebrows: ['eyebrows_brookie', 'eyebrows_innocent', 'eyebrows_reynolds', 'eyebrows_tyler', 'eyebrows_npc', undefined],
//   mouths: ['mouth_polite_smile', 'mouth_prettypolite_smile', 'mouth_npc'],
//   hair: ['hair_ponytail', 'hair_multicolor', 'hair_thick_buzzcut', 'hair_cool', 'hair_kevin', 'hair_wolf', undefined],
//   facialhair: [undefined, 'facialhair_almond', 'facialhair_bigboi', 'facialhair_curled', 'facialhair_johnny', 'facialhair_laotzu'],
//   clothes: ['clothes_poloshirt', 'clothes_button_dress', 'clothes_casual_dress', 'clothes_fancy_dress', 'clothes_tshirt', 'clothes_turtleneck', 'clothes_vneck', undefined],
//   accessories: [undefined, 'accessories_cateye', 'accessories_round', 'accessories_square'],
//   jewelry: [undefined, 'jewelry_pearl', 'jewelry_diamond', 'jewelry_diamond2', 'jewelry_diamond3', 'jewelry_sparkling_hoopdrop_gold', 'jewelry_sparkling_hoopdrop_silver', 'jewelry_diamond_tripple', 'jewelry_hoopdroop_gold', 'jewelry_hoopdroop_silver', 'jewelry_pearl_tripple', 'jewelry_star_tripple_gold', 'jewelry_star_tripple_silver'],
//   layer: [undefined, 'layer_lowrider', 'layer_safari']
// } as const;

export const skinParts = ['hands', 'heads', 'torsos'] as const;
export type SkinPart = typeof skinParts[number];

const literalArray = skinParts.map(s => z.literal(s))

function partSchemaCreator<T extends ZodUnion<ZodUnionOptions>>(modelSchema: T) {
  return z.object({
    model: modelSchema,
    colors: z.array(z.string()),
  })
}

export const AvatarDesignSchema = z.object({
  skinColor: z.string().optional(),
  parts: z.object({
    hands: z.object({ model: z.literal('hands_basic_left') }),
    heads: z.object({ model: z.literal('heads_basic') }),
    torsos: z.object({ model: z.literal('torsos_basic_male') }),
    eyes: partSchemaCreator(z.union([z.literal('eyes_huge'), z.literal('eyes_relaxed'), z.literal('eyes_cool'), z.literal('eyes_kind'), z.literal('eyes_round'), z.literal('eyes_npc')])),
    eyebrows: partSchemaCreator(z.union([z.literal('eyebrows_brookie'), z.literal('eyebrows_innocent'), z.literal('eyebrows_reynolds'), z.literal('eyebrows_tyler'), z.literal('eyebrows_npc'), z.undefined()])),
    mouths: partSchemaCreator(z.union([z.literal('mouth_polite_smile'), z.literal('mouth_prettypolite_smile'), z.literal('mouth_npc')])),
    hair: partSchemaCreator(z.union([z.literal('hair_ponytail'), z.literal('hair_multicolor'), z.literal('hair_thick_buzzcut'), z.literal('hair_cool'), z.literal('hair_kevin'), z.literal('hair_wolf'), z.undefined()])),
    facialhair: partSchemaCreator(z.union([z.undefined(), z.literal('facialhair_almond'), z.literal('facialhair_bigboi'), z.literal('facialhair_curled'), z.literal('facialhair_johnny'), z.literal('facialhair_laotzu')])),
    clothes: partSchemaCreator(z.union([z.literal('clothes_poloshirt'), z.literal('clothes_button_dress'), z.literal('clothes_casual_dress'), z.literal('clothes_fancy_dress'), z.literal('clothes_tshirt'), z.literal('clothes_turtleneck'), z.literal('clothes_vneck'), z.undefined()])),
    accessories: partSchemaCreator(z.union([z.undefined(), z.literal('accessories_cateye'), z.literal('accessories_round'), z.literal('accessories_square')])),
    jewelry: partSchemaCreator(z.union([z.undefined(), z.literal('jewelry_pearl'), z.literal('jewelry_diamond'),])),
    layer: partSchemaCreator(z.union([z.undefined(), z.literal('layer_lowrider'), z.literal('layer_safari')]))
  })
});
export type AvatarDesign = z.TypeOf<typeof AvatarDesignSchema>;
type PartsWithColor = Omit<AvatarDesign['parts'], SkinPart>
export type PartKeyWithColor = keyof PartsWithColor
// export type PartWithColor = PartsWithColor[keyof PartsWithColor]

export const defaultAvatarDesign: AvatarDesign = {
  skinColor: undefined,
  parts: {
    hands: { model: 'hands_basic_left' },
    heads: { model: 'heads_basic' },
    torsos: { model: 'torsos_basic_male' },
    eyes: {
      model: 'eyes_huge',
      colors: [],
    },
    eyebrows: {
      model: 'eyebrows_brookie',
      colors: [],
    },
    mouths: {
      model: 'mouth_polite_smile',
      colors: [],
    },
    hair: {
      model: 'hair_ponytail',
      colors: [],
    },
    facialhair: {
      model: undefined,
      colors: [],
    },
    clothes: {
      model: 'clothes_poloshirt',
      colors: [],
    },
    accessories: {
      model: undefined,
      colors: [],
    },
    jewelry: {
      model: undefined,
      colors: [],
    },
    layer: {
      model: undefined,
      colors: [],
    }
  }
}

// TODO: Make the generated avatarAssets object below typed
const partSchema = AvatarDesignSchema.shape.parts;
const partKeys = partSchema.keyof().options;
// const [heads, hands, torsos, ...nonBodyPartKeys] = partKeys;
// const key = partKeys[6];
// const part = partSchema.shape[key];
// const model = part.shape.model.options[0].value;
let assetsBuildingObj = {};
for (const partKey of partKeys) {
  const partTypeSchema = partSchema.shape[partKey];
  if (partTypeSchema instanceof ZodObject) {
    assetsBuildingObj[partKey] = [];
    const modelSchema = partTypeSchema.shape.model;
    if (modelSchema instanceof ZodLiteral) {
      assetsBuildingObj[partKey].push(modelSchema.value);
    } else if (modelSchema instanceof ZodUnion) {
      for (const option of partTypeSchema.shape.model.options) {
        assetsBuildingObj[partKey].push(option.value);
      }
    }
  }
}
export const avatarAssets = assetsBuildingObj;

// console.log(assetsBuildingObj);
// const hairKey = partKeys[6];
// const hairParts = partSchema.shape[partKeys[6]].options[0].value

// export const ClientInfoSchema = z.object({
//   userId: UserIdSchema,
//   role: UserRoleSchema,
//   position: z.optional(ClientTransformSchema)
// })
// export type ClientInfo = z.TypeOf<typeof ClientInfoSchema>;

export const ClientTypeSchema = z.union([z.literal('client'), z.literal('sender')]);
export type ClientType = z.TypeOf<typeof ClientTypeSchema>;

export const LocalClientInitDataSchema = z.object({
  avatarDesign: AvatarDesignSchema,

})