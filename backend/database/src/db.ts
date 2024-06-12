import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, eq } from "drizzle-orm";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL env var');
}
// const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });

export const client = postgres(process.env.DATABASE_URL);
export const db = drizzle(client, { schema });

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

export const queryStreamWithIncludes = db.query.streams.findFirst({
  where: (stream, { eq }) => eq(stream.streamId, sql.placeholder('streamId')),
  with: {
    cameras: {
      columns: {
        cameraId: true,
      }
      // with: {
      //   toCameras: true,
      //   fromCameras: true,
      // }
    },
    mainCamera: {
      columns: {
        cameraId: true,
      }
    },
    owner: {
      columns: basicUserSelect,
    },
    allowedUsers: true,
    // vrSpace: {
    //   with: {
    //     worldModelAsset: true,
    //     navMeshAsset: true,
    //     panoramicPreview: true,
    //     placedObjects: true,
    //   }
    // }
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
    placedObjects: true,
    allowedUsers: true,
  }
}).prepare('queryVrSpaceWithIncludes');
export type VrSpaceWithIncludes = NonNullable<Awaited<ReturnType<typeof queryVrSpaceWithIncludes.execute>>>

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