import { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, pgEnum, varchar, timestamp, text, integer, uniqueIndex, uuid, boolean, jsonb, foreignKey, real, doublePrecision, index, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { relations } from "drizzle-orm/relations";

import type { StreamId, UserId, VrSpaceId, AssetId, CameraId, PlacementId, SenderId } from 'schemas';

export const CameraType = pgEnum("CameraType", ['panoramic360', 'normal'])
// export const AssetFileFormat = pgEnum("AssetFileFormat", ['glb', 'png', 'jpg', 'jpeg', 'pdf',])
export const AssetType = pgEnum("AssetType", ['image', 'video', 'model', 'navmesh', 'document']);
export const PlacedObjectType = pgEnum("PlacedObjectType", ['asset', 'vrPortal', 'streamPortal', 'externalLinkPortal', 'pointLight', 'directionalLight', 'ambientLight']);
// export const PortalType = pgEnum("PortalType", ['vrSpace', 'stream', 'externalUrl']);
export const Role = pgEnum("Role", ['gunnar', 'superadmin', 'admin', 'moderator', 'user', 'guest'])
export const Visibility = pgEnum("Visibility", ['private', 'unlisted', 'public'])

const createdAndUpdatedAt = {
	createdAt: timestamp("createdAt", { precision: 3, mode: 'date' }).defaultNow(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: 'date' }).$onUpdate(() => new Date()),
}

// export const posts = pgTable("Posts", {
// 	postId: uuid("postId").defaultRandom().primaryKey().notNull(),
// 	text: text("text").notNull(),
// })

// export const postsRelations = relations(posts, ({ many }) => ({
// 	tags: many(postsToTags),
// }))

// export const tags = pgTable("Tags", {
// 	tagId: uuid("tagId").defaultRandom().primaryKey().notNull(),
// 	name: text("name").notNull(),
// });

// export const tagsRelations = relations(tags, ({ many }) => ({
// 	posts: many(postsToTags),
// }))

// export const postsToTags = pgTable("PostsToTags", {
// 	postId: uuid("postId").notNull().references(() => posts.postId, { onDelete: "cascade", onUpdate: "cascade" }),
// 	tagId: uuid("tagId").notNull().references(() => tags.tagId, { onDelete: "cascade", onUpdate: "cascade" }),
// },
// 	t => ({ pk: primaryKey({ columns: [t.postId, t.tagId] }) }),
// );

// export const tagsJoinRelations = relations(postsToTags, ({ one }) => ({
// 	tag: one(tags, {
// 		fields: [postsToTags.tagId],
// 		references: [tags.tagId],
// 	}),
// 	post: one(posts, {
// 		fields: [postsToTags.postId],
// 		references: [posts.postId],
// 	})
// }))

export const sessions = pgTable("Sessions", {
	id: text("id").primaryKey().notNull(),
	sid: text("sid").notNull(),
	data: text("data").notNull(),
	expiresAt: timestamp("expiresAt", { precision: 3, mode: 'string' }).notNull(),
},
	(table) => {
		return {
			sid_key: uniqueIndex("Session_sid_key").on(table.sid),
		}
	});

export const users = pgTable("Users", {
	userId: uuid("userId").defaultRandom().primaryKey().notNull().$type<UserId>(),
	...createdAndUpdatedAt,
	username: text("username").notNull(),
	password: text("password").notNull(),
	role: Role("role").default('user').notNull(),
},
	(table) => {
		return {
			username_key: uniqueIndex("User_username_key").on(table.username),
		}
	});

export const usersRelations = relations(users, ({ many }) => ({
	assets: many(assets),
	streams: many(streams),
	permissions: many(permissions),
}));

export const PermissionTargetType = pgEnum("PermissionTargetType", ['stream', 'vrSpace'])
export const PermissionLevel = pgEnum("PermissionLevel", ['edit', 'owner'])
export const permissions = pgTable("Permissions", {
	userId: uuid("userId").notNull().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	targetType: PermissionTargetType("targetType").notNull(),
	targetId: uuid("targetId").notNull().$type<StreamId | VrSpaceId>(),
	permissionLevel: PermissionLevel("permissionLevel").default('edit').notNull(),
})

export const permissionsRelations = relations(permissions, ({ one }) => ({
	user: one(users, {
		fields: [permissions.userId],
		references: [users.userId]
	}),
	stream: one(streams, {
		fields: [permissions.targetId],
		references: [streams.streamId]
	}),
	vrSpace: one(vrSpaces, {
		fields: [permissions.targetId],
		references: [vrSpaces.vrSpaceId]
	})
}))

export const streams = pgTable("Streams", {
	streamId: uuid("streamId").defaultRandom().primaryKey().notNull().$type<StreamId>(),
	name: text("name").notNull(),
	ownerUserId: uuid("ownerUserId").notNull().$type<UserId>(),//.references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	// doorsOpeningTime: timestamp("doorsOpeningTime", { precision: 3, mode: 'string' }),
	// doorsAutoOpen: boolean("doorsAutoOpen").default(false).notNull(),
	// doorsManuallyOpened: boolean("doorsManuallyOpened").default(false).notNull(),
	streamStartTime: timestamp("streamStartTime", { precision: 3, mode: 'date' }),
	streamAutoStart: boolean("streamAutoStart").default(false).notNull(),
	streamManuallyStarted: boolean("streamManuallyStarted").default(false).notNull(),
	streamManuallyEnded: boolean("streamManuallyEnded").default(false).notNull(),
	// extraSettings: jsonb("extraSettings"),
	visibility: Visibility("visibility").default('public').notNull(),
	mainCameraId: uuid("mainCameraId").references((): AnyPgColumn => cameras.cameraId).$type<CameraId>(),
	vrSpaceId: uuid("vrSpaceId").references((): AnyPgColumn => vrSpaces.vrSpaceId).$type<VrSpaceId>(),
	...createdAndUpdatedAt,
},
	(table) => {
		return {
			name_key: uniqueIndex("Stream_name_key").on(table.name),
		}
	});


export const streamsRelations = relations(streams, ({ many, one }) => ({
	owner: one(users, {
		fields: [streams.ownerUserId],
		references: [users.userId],
	}),
	cameras: many(cameras,
		{ relationName: 'camerasInStream', }
	),
	mainCamera: one(cameras, {
		fields: [streams.mainCameraId],
		references: [cameras.cameraId],
		relationName: 'mainCameraInStream',
	}),
	vrSpace: one(vrSpaces, {
		fields: [streams.vrSpaceId],
		references: [vrSpaces.vrSpaceId],
	}),
	allowedUsers: many(permissions)
	// _usersOwningVenues: many(_usersOwningVenues),
	// _usersAllowedInVenues: many(_usersAllowedInVenues),
	// _usersBannedFromVenues: many(_usersBannedFromVenues),
	// VirtualSpaces: many(VirtualSpace),
}));


export const cameras = pgTable("Cameras", {
	cameraId: uuid("cameraId").defaultRandom().primaryKey().notNull().$type<CameraId>(),
	name: text("name").notNull(),
	streamId: uuid("streamId").notNull().references(() => streams.streamId, { onDelete: "cascade", onUpdate: "cascade" }).$type<StreamId>(),
	senderId: uuid("senderId").$type<SenderId>(),
	cameraType: CameraType("cameraType").default('panoramic360').notNull(),
	viewOriginX: doublePrecision("viewOriginX").default(0.5).notNull(),
	viewOriginY: doublePrecision("viewOriginY").default(0.5).notNull(),
	fovStart: doublePrecision("fovStart").default(0).notNull(),
	fovEnd: doublePrecision("fovEnd").default(1).notNull(),
	orientation: doublePrecision("orientation").default(0).notNull(),
	...createdAndUpdatedAt,
	// settings: jsonb("settings"),
},
	(table) => {
		return {
			// unique camera names within each stream
			name_streamId_key: uniqueIndex("cameras_name_streamId_key").on(table.name, table.streamId),
			// unique sender ids within each stream
			senderId_streamId_key: uniqueIndex("cameras_senderId_streamId_key").on(table.streamId, table.senderId),
		}
	});

export const camerasRelations = relations(cameras, ({ one, many }) => ({
	stream: one(streams, {
		fields: [cameras.streamId],
		references: [streams.streamId],
		relationName: "camerasInStream",
	}),
	mainCameraInStream: one(streams, {
		fields: [cameras.cameraId],
		references: [streams.streamId],
		relationName: "mainCameraInStream",
	}),
	fromCameras: many(cameraPortals, {
		relationName: "cameraPortals_fromCameraId_cameras_cameraId"
	}),
	toCameras: many(cameraPortals, {
		relationName: "cameraPortals_toCameraId_cameras_cameraId"
	}),
}));

//join table
export const cameraPortals = pgTable("CameraPortals", {
	fromCameraId: uuid("fromCameraId").notNull().references(() => cameras.cameraId, { onDelete: "cascade", onUpdate: "cascade" }).$type<CameraId>(),
	toCameraId: uuid("toCameraId").notNull().references(() => cameras.cameraId, { onDelete: "cascade", onUpdate: "cascade" }).$type<CameraId>(),
	x: doublePrecision("x").notNull(),
	y: doublePrecision("y").notNull(),
	distance: doublePrecision("distance").notNull(),
	...createdAndUpdatedAt,
},
	(table) => {
		return {
			cameraPortals_pkey: primaryKey({ columns: [table.fromCameraId, table.toCameraId], name: "cameraPortals_pkey" }),
		}
	});

export const cameraPortalsRelations = relations(cameraPortals, ({ one }) => ({
	fromCamera: one(cameras, {
		fields: [cameraPortals.fromCameraId],
		references: [cameras.cameraId],
		relationName: "cameraPortals_fromCameraId_cameras_cameraId"
	}),
	toCamera: one(cameras, {
		fields: [cameraPortals.toCameraId],
		references: [cameras.cameraId],
		relationName: "cameraPortals_toCameraId_cameras_cameraId"
	}),
}));

export const assets = pgTable("Assets", {
	assetId: uuid("assetId").defaultRandom().primaryKey().notNull().$type<AssetId>(),
	assetType: AssetType("assetType").notNull(),
	originalFileName: text("originalFileName").notNull(),
	generatedName: uuid("generatedName").unique().notNull(),
	assetFileExtension: text("assetFileExtension").notNull(),
	ownerUserId: uuid("ownerUserId").notNull().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }).$type<UserId>(),
	// extraSettings: jsonb("extraSettings"),
	...createdAndUpdatedAt,
})

export const assetsRelations = relations(assets, ({ one, many }) => ({
	owner: one(users, {
		fields: [assets.ownerUserId],
		references: [users.userId]
	}),

	// Do we actually need these?
	worldModelInVrSpace: many(vrSpaces, { relationName: 'worldModelAsset' }),
	navMeshInVrSpace: many(vrSpaces, { relationName: 'navMeshAsset' }),
	panoramicPreviewInVrSpace: many(vrSpaces, { relationName: 'panoramicPreview' }),

}))

export const vrSpaces = pgTable("VrSpaces", {
	vrSpaceId: uuid("vrSpaceId").defaultRandom().primaryKey().notNull().$type<VrSpaceId>(),
	worldModelAssetId: uuid("worldModelAssetId").references(() => assets.assetId).$type<AssetId>(),
	navMeshAssetId: uuid("navMeshAssetId").references(() => assets.assetId).$type<AssetId>(),
	panoramicPreviewAssetId: uuid('panoramicPreview').references(() => assets.assetId),
	Visibility: Visibility("visibility").default('public').notNull(),
	worldModelScale: doublePrecision("worldModelScale").default(1).notNull(),
	spawnPosition: real("spawnPosition").array(),
	spawnRadius: doublePrecision("spawnRadius"),
	skyColor: text("skyColor"),
	...createdAndUpdatedAt,
});

export const vrSpacesRelations = relations(vrSpaces, ({ one, many }) => ({
	worldModelAsset: one(assets, {
		fields: [vrSpaces.worldModelAssetId],
		references: [assets.assetId],
		relationName: 'worldModelAsset',
	}),
	navMeshAsset: one(assets, {
		fields: [vrSpaces.navMeshAssetId],
		references: [assets.assetId],
		relationName: 'navMeshAsset',
	}),
	panoramicPreview: one(assets, {
		fields: [vrSpaces.panoramicPreviewAssetId],
		references: [assets.assetId],
		relationName: 'panoramicPreview',
	}),
	placedObjects: many(placedObjects, {
		relationName: 'placedObjects',
	}),
	allowedUsers: many(permissions)
}))


export const placedObjects = pgTable("PlacedObjects", {
	placementId: uuid("placementId").defaultRandom().primaryKey().notNull().$type<PlacementId>(),
	vrSpaceId: uuid("vrSpaceId").notNull().references(() => vrSpaces.vrSpaceId, { onDelete: "cascade", onUpdate: "cascade" }).$type<VrSpaceId>(),
	// assetId: uuid("assetId").references(() => Asset.assetId, { onDelete: "cascade", onUpdate: "cascade" }),
	// vrPortalId: uuid("vrPortalId").references(() => VrPortal.portalId, { onDelete: "cascade", onUpdate: "cascade" }),

	// Lets try polymorphism!!!
	type: PlacedObjectType("type").notNull(),
	objectId: uuid('objectId').$type<AssetId | VrSpaceId | StreamId>(),
	objectSettings: jsonb("objectSettings"),
	position: real("position").array(),
	orientation: real("orientation").array(),
	scale: real("scale").array(),
	...createdAndUpdatedAt,
});

export const placedObjectsRelations = relations(placedObjects, ({ one }) => ({
	placedInVrSpace: one(vrSpaces, {
		fields: [placedObjects.vrSpaceId],
		references: [vrSpaces.vrSpaceId],
		relationName: 'placedObjects',
	}),
	asset: one(assets, {
		fields: [placedObjects.objectId],
		references: [assets.assetId]
	}),
	vrPortal: one(vrSpaces, {
		fields: [placedObjects.objectId],
		references: [vrSpaces.vrSpaceId]
	}),
	streamPortal: one(streams, {
		fields: [placedObjects.objectId],
		references: [streams.streamId]
	})
}));

// export const VrPortal = pgTable("VrPortal", {
// 	portalId: uuid("portalId").defaultRandom().primaryKey().notNull(),
// 	type: PortalType("type").default('vrSpace').notNull(),
// 	// vrSpaceId: uuid("vrSpaceId").references(() => VrSpace.vrSpaceId, { onDelete: "cascade", onUpdate: "cascade" }),
// 	// streamId: uuid("streamId").references(() => Stream.streamId, { onDelete: "cascade", onUpdate: "cascade" }),

// 	// Again, let's try polymorphism!!
// 	objectId: uuid('objectId'),
// 	externalUrl: text("externalUrl"),
// });

// export const VrPortalRelations = relations(VrPortal, ({ one }) => ({
// 	vrSpace: one(VrSpace, {
// 		fields: [VrPortal.objectId],
// 		references: [VrSpace.vrSpaceId]
// 	}),
// 	stream: one(Stream, {
// 		fields: [VrPortal.objectId],
// 		references: [Stream.streamId]
// 	}),
// }));