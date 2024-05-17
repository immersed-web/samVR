import { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, pgEnum, varchar, timestamp, text, integer, uniqueIndex, uuid, boolean, jsonb, foreignKey, real, doublePrecision, index, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { relations } from "drizzle-orm/relations";
// import { Venue, Camera, User, _usersOwningVenues, _usersAllowedInVenues, _usersBannedFromVenues, VirtualSpace, VirtualSpace3DModel, CameraPortal } from "./schema";

export const CameraType = pgEnum("CameraType", ['panoramic360', 'normal'])
// export const AssetFileFormat = pgEnum("AssetFileFormat", ['glb', 'png', 'jpg', 'jpeg', 'pdf',])
export const AssetType = pgEnum("AssetType", ['image', 'video', 'model', 'navmesh', 'document']);
export const PlacedObjectType = pgEnum("PlacedObjectType", ['asset', 'vrPortal', 'streamPortal', 'externalLinkPortal', 'pointLight', 'directionalLight', 'ambientLight']);
export const PortalType = pgEnum("PortalType", ['vrSpace', 'stream', 'externalUrl']);
export const Role = pgEnum("Role", ['gunnar', 'superadmin', 'admin', 'moderator', 'sender', 'user', 'guest'])
export const Visibility = pgEnum("Visibility", ['private', 'unlisted', 'public'])

const createdAndUpdatedAt = {
	createdAt: timestamp("createdAt", { precision: 3, mode: 'date' }).defaultNow(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: 'date' }).$onUpdate(() => sql`CURRENT_TIMESTAMP`),
}

export const Session = pgTable("Session", {
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

export const User = pgTable("User", {
	userId: uuid("userId").defaultRandom().primaryKey().notNull(),
	...createdAndUpdatedAt,
	// updatedAt: timestamp("updatedAt", { precision: 3, mode: 'date' }).$onUpdate(() => sql`CURRENT_TIMESTAMP`),
	username: text("username").notNull(),
	password: text("password").notNull(),
	role: Role("role").default('user').notNull(),
},
	(table) => {
		return {
			username_key: uniqueIndex("User_username_key").on(table.username),
		}
	});

export const UserRelations = relations(User, ({ many }) => ({
	assets: many(Asset),
	// _usersOwningVenues: many(_usersOwningVenues),
	// _usersAllowedInVenues: many(_usersAllowedInVenues),
	// _usersBannedFromVenues: many(_usersBannedFromVenues),
}));

// export const _usersOwningVenuesRelations = relations(_usersOwningVenues, ({one}) => ({
// 	User: one(User, {
// 		fields: [_usersOwningVenues.A],
// 		references: [User.userId]
// 	}),
// 	Venue: one(Venue, {
// 		fields: [_usersOwningVenues.B],
// 		references: [Venue.venueId]
// 	}),
// }));


// export const _usersAllowedInVenuesRelations = relations(_usersAllowedInVenues, ({one}) => ({
// 	User: one(User, {
// 		fields: [_usersAllowedInVenues.A],
// 		references: [User.userId]
// 	}),
// 	Venue: one(Venue, {
// 		fields: [_usersAllowedInVenues.B],
// 		references: [Venue.venueId]
// 	}),
// }));

// export const _usersBannedFromVenuesRelations = relations(_usersBannedFromVenues, ({one}) => ({
// 	User: one(User, {
// 		fields: [_usersBannedFromVenues.A],
// 		references: [User.userId]
// 	}),
// 	Venue: one(Venue, {
// 		fields: [_usersBannedFromVenues.B],
// 		references: [Venue.venueId]
// 	}),
// }));

export const Stream = pgTable("Stream", {
	streamId: uuid("streamId").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	owner: uuid("owner").notNull().references(() => User.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	// doorsOpeningTime: timestamp("doorsOpeningTime", { precision: 3, mode: 'string' }),
	// doorsAutoOpen: boolean("doorsAutoOpen").default(false).notNull(),
	// doorsManuallyOpened: boolean("doorsManuallyOpened").default(false).notNull(),
	// streamStartTime: timestamp("streamStartTime", { precision: 3, mode: 'string' }),
	// streamAutoStart: boolean("streamAutoStart").default(false).notNull(),
	// streamManuallyStarted: boolean("streamManuallyStarted").default(false).notNull(),
	// streamManuallyEnded: boolean("streamManuallyEnded").default(false).notNull(),
	// extraSettings: jsonb("extraSettings"),
	visibility: Visibility("visibility").default('public').notNull(),
	mainCameraId: uuid("mainCameraId").references((): AnyPgColumn => Camera.cameraId,),
	...createdAndUpdatedAt,
},
	(table) => {
		return {
			name_key: uniqueIndex("Stream_name_key").on(table.name),
		}
	});


export const StreamRelations = relations(Stream, ({ many, one }) => ({
	Cameras: many(Camera),
	MainCamera: one(Camera, {
		fields: [Stream.mainCameraId],
		references: [Camera.cameraId]
	})
	// _usersOwningVenues: many(_usersOwningVenues),
	// _usersAllowedInVenues: many(_usersAllowedInVenues),
	// _usersBannedFromVenues: many(_usersBannedFromVenues),
	// VirtualSpaces: many(VirtualSpace),
}));


export const Camera = pgTable("Camera", {
	cameraId: uuid("cameraId").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	streamId: uuid("streamId").notNull().references(() => Stream.streamId, { onDelete: "cascade", onUpdate: "cascade" }),
	senderId: uuid("senderId"),
	cameraType: CameraType("cameraType").default('panoramic360').notNull(),
	viewOriginX: doublePrecision("viewOriginX").default(0.5).notNull(),
	viewOriginY: doublePrecision("viewOriginY").default(0.5).notNull(),
	fovStart: doublePrecision("fovStart").notNull(),
	fovEnd: doublePrecision("fovEnd").default(1).notNull(),
	orientation: doublePrecision("orientation").notNull(),
	...createdAndUpdatedAt,
	// settings: jsonb("settings"),
},
	(table) => {
		return {
			// unique camera names within each stream
			name_streamId_key: uniqueIndex("Camera_name_streamId_key").on(table.name, table.streamId),
			// unique sender ids within each stream
			senderId_streamId_key: uniqueIndex("Camera_senderId_streamId_key").on(table.streamId, table.senderId),
		}
	});

export const CameraRelations = relations(Camera, ({ one, many }) => ({
	Camera: one(Stream, {
		fields: [Camera.streamId],
		references: [Stream.streamId]
	}),
	CameraPortals_fromCameraId: many(CameraPortal, {
		relationName: "CameraPortal_fromCameraId_Camera_cameraId"
	}),
	CameraPortals_toCameraId: many(CameraPortal, {
		relationName: "CameraPortal_toCameraId_Camera_cameraId"
	}),
}));


// export const _usersOwningVenues = pgTable("_usersOwningVenues", {
// 	A: uuid("A").notNull().references(() => User.userId, { onDelete: "cascade", onUpdate: "cascade" }),
// 	B: uuid("B").notNull().references(() => Venue.venueId, { onDelete: "cascade", onUpdate: "cascade" }),
// },
// 	(table) => {
// 		return {
// 			AB_unique: uniqueIndex("_usersOwningVenues_AB_unique").on(table.A, table.B),
// 			B_idx: index().on(table.B),
// 		}
// 	});

// export const _usersAllowedInVenues = pgTable("_usersAllowedInVenues", {
// 	A: uuid("A").notNull().references(() => User.userId, { onDelete: "cascade", onUpdate: "cascade" }),
// 	B: uuid("B").notNull().references(() => Venue.venueId, { onDelete: "cascade", onUpdate: "cascade" }),
// },
// 	(table) => {
// 		return {
// 			AB_unique: uniqueIndex("_usersAllowedInVenues_AB_unique").on(table.A, table.B),
// 			B_idx: index().on(table.B),
// 		}
// 	});

// export const _usersBannedFromVenues = pgTable("_usersBannedFromVenues", {
// 	A: uuid("A").notNull().references(() => User.userId, { onDelete: "cascade", onUpdate: "cascade" }),
// 	B: uuid("B").notNull().references(() => Venue.venueId, { onDelete: "cascade", onUpdate: "cascade" }),
// },
// 	(table) => {
// 		return {
// 			AB_unique: uniqueIndex("_usersBannedFromVenues_AB_unique").on(table.A, table.B),
// 			B_idx: index().on(table.B),
// 		}
// 	});

export const Asset = pgTable("Asset", {
	assetId: uuid("assetId").defaultRandom().primaryKey().notNull(),
	assetType: AssetType("assetType").notNull(),
	originalFileName: text("originalFileName").notNull(),
	generatedName: uuid("generatedName").unique().notNull(),
	assetFileExtension: text("assetFileExtension").notNull(),
	// createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).notNull(),
	// updatedAt: timestamp("updatedAt", { precision: 3, mode: 'string' }).notNull(),
	ownerUserId: uuid("ownerUserId").notNull().references(() => User.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	// extraSettings: jsonb("extraSettings"),
	...createdAndUpdatedAt,
})

export const AssetRelations = relations(Asset, ({ one, many }) => ({
	owner: one(User, {
		fields: [Asset.ownerUserId],
		references: [User.userId]
	}),

	// Do we actually need these?
	worldModelInVrSpace: many(VrSpace, { relationName: 'worldModelAsset' }),
	navMeshInVrSpace: many(VrSpace, { relationName: 'navMeshAsset' }),
	panoramicPreviewInVrSpace: many(VrSpace, { relationName: 'panoramicPreview' }),

}))

export const VrSpace = pgTable("VrSpace", {
	vrSpaceId: uuid("vrSpaceId").defaultRandom().primaryKey().notNull(),
	worldModelAssetId: uuid("worldModelAssetId").notNull().references(() => Asset.assetId),
	navMeshAssetId: uuid("navMeshAssetId").references(() => Asset.assetId),
	panoramicPreview: uuid('panoramicPreview').references(() => Asset.assetId),
	Visibility: Visibility("visibility").default('public').notNull(),
	worldModelScale: doublePrecision("worldModelScale").default(1).notNull(),
	spawnPosition: real("spawnPosition").array(),
	spawnRadius: doublePrecision("spawnRadius"),
	skyColor: text("skyColor"),
	...createdAndUpdatedAt,
});

export const VrSpaceRelations = relations(VrSpace, ({ one, many }) => ({
	worldModelAsset: one(Asset, {
		fields: [VrSpace.worldModelAssetId],
		references: [Asset.assetId],
		relationName: 'worldModelAsset',
	}),
	navMeshAsset: one(Asset, {
		fields: [VrSpace.navMeshAssetId],
		references: [Asset.assetId],
		relationName: 'navMeshAsset',
	}),
	panoramicPreview: one(Asset, {
		fields: [VrSpace.panoramicPreview],
		references: [Asset.assetId],
		relationName: 'panoramicPreview',
	}),
	placedObjects: many(Placement, {
		relationName: 'placedInVrSpace',
	}),
}))

export const Placement = pgTable("Placement", {
	placementId: uuid("placementId").defaultRandom().primaryKey().notNull(),
	vrSpaceId: uuid("vrSpaceId").notNull().references(() => VrSpace.vrSpaceId, { onDelete: "cascade", onUpdate: "cascade" }),
	type: PlacedObjectType("type").notNull(),
	// assetId: uuid("assetId").references(() => Asset.assetId, { onDelete: "cascade", onUpdate: "cascade" }),
	// vrPortalId: uuid("vrPortalId").references(() => VrPortal.portalId, { onDelete: "cascade", onUpdate: "cascade" }),

	// Lets try polymorphism!!!
	objectId: uuid('objectId'),
	objectSettings: jsonb("objectSettings"),
	position: real("position").array(),
	orientation: real("orientation").array(),
	scale: real("scale").array(),
	...createdAndUpdatedAt,
});

export const PlacementRelations = relations(Placement, ({ one }) => ({
	placedInVrSpace: one(VrSpace, {
		fields: [Placement.vrSpaceId],
		references: [VrSpace.vrSpaceId],
		relationName: 'placedInVrSpace',
	}),
	asset: one(Asset, {
		fields: [Placement.objectId],
		references: [Asset.assetId]
	}),
	vrPortal: one(VrSpace, {
		fields: [Placement.objectId],
		references: [VrSpace.vrSpaceId]
	}),
	streamPortal: one(Stream, {
		fields: [Placement.objectId],
		references: [Stream.streamId]
	})
}));


// export const VirtualSpace3DModelRelations = relations(VirtualSpace3DModel, ({many}) => ({
// 	VirtualSpaces: many(VirtualSpace),
// }));

export const CameraPortal = pgTable("CameraPortal", {
	fromCameraId: uuid("fromCameraId").notNull().references(() => Camera.cameraId, { onDelete: "cascade", onUpdate: "cascade" }),
	toCameraId: uuid("toCameraId").notNull().references(() => Camera.cameraId, { onDelete: "cascade", onUpdate: "cascade" }),
	x: doublePrecision("x").notNull(),
	y: doublePrecision("y").notNull(),
	distance: doublePrecision("distance").notNull(),
	...createdAndUpdatedAt,
},
	(table) => {
		return {
			CameraPortal_pkey: primaryKey({ columns: [table.fromCameraId, table.toCameraId], name: "CameraPortal_pkey" }),
		}
	});

export const CameraPortalRelations = relations(CameraPortal, ({ one }) => ({
	Camera_fromCameraId: one(Camera, {
		fields: [CameraPortal.fromCameraId],
		references: [Camera.cameraId],
		relationName: "CameraPortal_fromCameraId_Camera_cameraId"
	}),
	Camera_toCameraId: one(Camera, {
		fields: [CameraPortal.toCameraId],
		references: [Camera.cameraId],
		relationName: "CameraPortal_toCameraId_Camera_cameraId"
	}),
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