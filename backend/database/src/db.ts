import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq, InferSelectModel, InferModelFromColumns, and } from "drizzle-orm";
import * as schema from "./schema.js";
import { Prettify, StreamId, UserId, VrSpaceId } from "schemas";

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL env var');
}

// export const client = postgres(process.env.DATABASE_URL);
// export const db = drizzle(client, { schema });
export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
  },
  schema,
});

type UserQueryInput = NonNullable<Required<Parameters<typeof db.query.users.findFirst>[0]>>;
type userQueryColumnInput = UserQueryInput['columns'];
export const basicUserSelect = {
  role: true,
  userId: true,
  username: true,
} as const satisfies userQueryColumnInput

export const userSelectExcludePassword = {
  password: false,
} as const satisfies userQueryColumnInput

export const queryUserWithIncludes = db.query.users.findFirst({
  where: (user, { eq }) => eq(user.userId, sql.placeholder('userId')),
  with: {
    ownedStreams: {
      columns: {
        streamId: true,
        name: true,
      },
    },
    ownedVrSpaces: {
      columns: {
        vrSpaceId: true,
        name: true,
      },
    },
    permissions: {
      columns: {
        permissionLevel: true
      },
      with: {
        stream: {
          columns: {
            streamId: true,
          }
        },
        vrSpace: {
          columns: {
            vrSpaceId: true
          }
        }
      }
    }
  }
}).prepare('queryUserWithIncludes')

type PermissionInclude = NonNullable<Awaited<ReturnType<typeof queryUserWithIncludes.execute>>>['permissions'];
type PermissionTargetType = keyof Omit<PermissionInclude[number], 'permissionLevel'>

type PermissionRow<T extends PermissionTargetType> = (PermissionInclude[number][T] & Pick<PermissionInclude[number], 'permissionLevel'>)

export function groupUserPermissions(permissions: PermissionInclude) {
  const groupedData = permissions.reduce<{ streams: PermissionRow<'stream'>[], vrSpaces: PermissionRow<'vrSpace'>[] }>((acc, perm) => {
    if (perm.stream) {
      const permRow: PermissionRow<'stream'> = { ...perm.stream, permissionLevel: perm.permissionLevel };
      acc.streams.push(permRow);
    } else if (perm.vrSpace) {
      const permRow: PermissionRow<'vrSpace'> = { ...perm.vrSpace, permissionLevel: perm.permissionLevel };
      acc.vrSpaces.push(permRow);
    }
    return acc;
  }, { streams: [], vrSpaces: [] });
  return groupedData;
}
type TargetObjectWithAllowedUsers = {
  ownerUserId: UserId,
  allowedUsers: {
    userId: UserId;
    targetType: PermissionTargetType;
    targetId: TargetId;
    permissionLevel: typeof schema.permissions.permissionLevel.enumValues[number];
  }[]
}
type TargetId = InferModelFromColumns<typeof schema.permissions._.columns>['targetId']
export async function getPermissionLevelForTarget(targetType: PermissionTargetType, targetId: TargetId, userId: UserId) {
  let targetObject: TargetObjectWithAllowedUsers | undefined;
  if (targetType === 'stream') {
    targetObject = await db.query.streams.findFirst({
      where: (stream, { eq }) => eq(stream.streamId, targetId as StreamId),
      with: {
        allowedUsers: {
          where: (perm, { eq }) => and(eq(perm.targetType, 'stream'), eq(perm.userId, userId)),
        }
      }
    });
  } else if (targetType === 'vrSpace') {
    targetObject = await db.query.vrSpaces.findFirst({
      where: (vrSpace, { eq }) => eq(vrSpace.vrSpaceId, targetId as VrSpaceId),
      with: {
        allowedUsers: {
          where: (perm, { eq }) => and(eq(perm.targetType, 'vrSpace'), eq(perm.userId, userId)),
        }
      }
    });
  } else {
    throw new Error('Invalid target type');
  }
  if (!targetObject) return undefined;
  if (targetObject.ownerUserId === userId) return 'owner';
  const foundPerm = targetObject.allowedUsers.find(perm => perm.userId === userId);
  if (!foundPerm) return undefined;
  return foundPerm.permissionLevel;
  // const permission = await db.query.permissions.findFirst({
  //   where: (perm, { eq }) => and(eq(perm.targetType, targetType), eq(perm.userId, userId), eq(perm.targetId, targetId)),
  //   with: {
  //     stream: {
  //       columns: {
  //         ownerUserId: true
  //       },
  //     },
  //     vrSpace: {
  //       columns: {
  //         ownerUserId: true
  //       },
  //     }
  //   }
  // })
  // if (!permission) return 'unauthorized';
  // if (permission.vrSpace.ownerUserId === userId) return 'owner';
  // if (permission.stream.ownerUserId === userId) return 'owner';
  // return permission.permissionLevel;
}

export const queryStreamWithIncludes = db.query.streams.findFirst({
  where: (stream, { eq }) => eq(stream.streamId, sql.placeholder('streamId')),
  with: {
    cameras: {
      columns: {
        cameraId: true,
      }
    },
    mainCamera: {
      columns: {
        cameraId: true,
      }
    },
    owner: {
      columns: basicUserSelect,
    },
    allowedUsers: {
      where: eq(schema.permissions.targetType, 'stream'),
      columns: {
        permissionLevel: true,
      },
      with: {
        user: {
          columns: basicUserSelect
        }
      }
    },
  }
}).prepare('queryStreamWithIncludes');
export type StreamWithIncludes = NonNullable<Awaited<ReturnType<typeof queryStreamWithIncludes.execute>>>;

export const queryCameraWithIncludes = db.query.cameras.findFirst({
  where: (camera, { eq }) => eq(camera.cameraId, sql.placeholder('cameraId')),
  with: {
    toCameras: {
      columns: {
        fromCameraId: false,
        createdAt: false,
        updatedAt: false,
      }
    },
    fromCameras: true,
  }
}).prepare('queryCameraWithIncludes')
export type CameraWithIncludes = NonNullable<Awaited<ReturnType<typeof queryCameraWithIncludes.execute>>>;

export const queryVrSpaceWithIncludes = db.query.vrSpaces.findFirst({
  where: (vrSpace, { eq }) => eq(vrSpace.vrSpaceId, sql.placeholder('vrSpaceId')),
  with: {
    worldModelAsset: true,
    navMeshAsset: true,
    panoramicPreview: true,
    placedObjects: {
      columns: {
        placedObjectId: true,
        position: true,
        orientation: true,
        type: true,
        scale: true,
        objectSettings: true,
        objectId: true,
        updatedAt: true,
      },
      with: {
        vrPortal: {
          columns: {
            vrSpaceId: true,
            name: true,
            visibility: true,
          },
          with: {
            panoramicPreview: true,
            allowedUsers: {
              columns: {
                permissionLevel: true,
                userId: true,
              }
            },
            owner: {
              columns: {
                userId: true,
              }
            },
          }
        },
        asset: true,
        streamPortal: true,
      }
    },
    allowedUsers: {
      where: eq(schema.permissions.targetType, 'vrSpace'),
      columns: {
        permissionLevel: true,
      },
      with: {
        user: {
          columns: basicUserSelect
        }
      }
    },
  }
}).prepare('queryVrSpaceWithIncludes');
export type VrSpaceWithIncludes = NonNullable<Awaited<ReturnType<typeof queryVrSpaceWithIncludes.execute>>>
export type PlacedObjectWithIncludes = VrSpaceWithIncludes['placedObjects'][number];
// type dd = PlacedObjectWithIncludes['position']
// type dd = PlacedObjectWithIncludes['orientation']

// type VrSpaceId = typeof schema.vrSpaces.$inferSelect.vrSpaceId;

// const uuid = 'asdf' as VrSpaceId;
// const rr = await db.query.vrSpaces.findFirst({
//   where: eq(schema.vrSpaces.vrSpaceId, uuid),
//   // extras: {
//   //   assets: (po, {sql}) => sql`lower(${po.name})`.as('assets'),
//   // },
//   with: {
//     allowedUsers: {
//       with: {
//         vrSpace: true,
//       }
//     },
//     placedObjects: {
//       with: {
//         asset: true,
//         vrPortal: true,
//         streamPortal: true,  
//       }
//     }
//   }

// })
  

// const resp = await db.query.vrSpaces.findFirst({
//   where: eq(schema.vrSpaces.vrSpaceId, uuid),
//   with: {
//     worldModelAsset: true,
//     navMeshAsset: true,
//     panoramicPreview: true,
//     placedObjects: {
//       with: {
//         asset: true,
//         vrPortal: true,
//         streamPortal: true,
//       }
//     },
//   }
// })

// // resp?.placedObjects.forEach(po => po.)

// const response = await db.query.posts.findFirst({
//   where: eq(schema.posts.postId, 'asdf'),
//   with: {
//     tags: true,
//   }
// })

// const joinedResponse = await db.select().from(schema.posts)
//   .leftJoin(schema.postsToTags, eq(schema.posts.postId, schema.postsToTags.postId))
//   .leftJoin(schema.tags, eq(schema.tags.tagId, schema.postsToTags.tagId))
//   .where(eq(schema.posts.postId, 'asdf'))

  
// joinedResponse[0].