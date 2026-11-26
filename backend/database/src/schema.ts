import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, pgEnum, varchar, timestamp, text, integer, uniqueIndex, uuid, boolean, json, jsonb, foreignKey, real, doublePrecision, index, primaryKey, unique, check, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { relations } from "drizzle-orm/relations";

import type { OrganizationId, UnitId, DepartmentId, StreamId, UserId, VrSpaceId, AssetId, CameraId, PlacedObjectId, SenderId, AllFileExtensions, AvatarDesign } from 'schemas';

export const CameraTypeEnum = pgEnum("CameraType", ['panoramic360', 'normal'])
// export const AssetFileFormat = pgEnum("AssetFileFormat", ['glb', 'png', 'jpg', 'jpeg', 'pdf',])
export const AssetTypeEnum = pgEnum("AssetType", ['image', 'video', 'model', 'navmesh', 'document']);
// export type AssetTypes = typeof AssetTypeEnum.enumValues[number];

export const PlacedObjectTypeEnum = pgEnum("PlacedObjectType", ['asset', 'vrPortal', 'streamPortal', 'externalLinkPortal', 'pointLight', 'directionalLight', 'ambientLight']);
// export const PortalType = pgEnum("PortalType", ['vrSpace', 'stream', 'externalUrl']);
export const RoleEnum = pgEnum("Role", ['god', 'superadmin', 'admin', 'moderator', 'user', 'guest'])
export const VisibilityEnum = pgEnum("Visibility", ['private', 'unlisted', 'public', 'organization', 'unit'])
export const OrganizationTypeEnum = pgEnum("OrganizationType", ['municipality', 'company', 'other'])
export const OrganizationRoleEnum = pgEnum("OrganizationRole", ['org_admin', 'member', 'basic'])
export const UnitRoleEnum = pgEnum("UnitRole", ['unit_admin', 'member'])
export const RequestStatusEnum = pgEnum("RequestStatus", ['requested', 'approved', 'rejected'])

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

export const session = pgTable("session", {
	// id: text("id").primaryKey().notNull(),
	sid: varchar("sid").primaryKey().notNull(),
	sess: json("sess").notNull(),
	expire: timestamp("expire", { precision: 6, mode: 'string' }).notNull(),
},
	(table) => {
		return {
			sid_key: uniqueIndex("Session_sid_key").on(table.sid),
			IDX_session_expire: index("IDX_session_expire").on(table.expire),
		}
	});

export const users = pgTable("Users", {
	userId: uuid("userId").defaultRandom().primaryKey().notNull().$type<UserId>(),
	...createdAndUpdatedAt,
	username: text("username").notNull(),
	password: text("password").notNull(),
	role: RoleEnum("role").default('user').notNull(),
	avatarDesign: json("avatarDesign").$type<AvatarDesign>(),
	// Blocked accounts cannot log in or keep a session. Set by a platform administrator.
	blockedAt: timestamp("blockedAt", { precision: 3, mode: 'date' }),
	blockedReason: text("blockedReason"),
	lastLoginAt: timestamp("lastLoginAt", { precision: 3, mode: 'date' }),
},
	(table) => {
		return {
			username_key: uniqueIndex("User_username_key").on(table.username),
		}
	});
export type User = typeof users.$inferSelect;

// Messages from administrators to users, shown inside SamVR (accounts have no e-mail address).
export const userMessages = pgTable("UserMessages", {
	messageId: uuid("messageId").defaultRandom().primaryKey().notNull(),
	userId: uuid("userId").notNull().$type<UserId>().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	fromUserId: uuid("fromUserId").$type<UserId>().references(() => users.userId, { onDelete: "set null", onUpdate: "cascade" }),
	subject: text("subject").notNull(),
	body: text("body").notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'date' }).defaultNow().notNull(),
	readAt: timestamp("readAt", { precision: 3, mode: 'date' }),
},
	(table) => ({
		inbox_idx: index("UserMessages_user_created_idx").on(table.userId, table.createdAt),
	}));

export const usersRelations = relations(users, ({ many }) => ({
	assets: many(assets),
	ownedStreams: many(streams),
	ownedVrSpaces: many(vrSpaces),
	permissions: many(permissions),
}));


// ---------------------------------------------------------------------------
// Organizations (municipalities, companies, ...) and their units.
// A user with no membership is an individual user. A unit always belongs to
// exactly one organization, and a unit member must also be an organization member.
// ---------------------------------------------------------------------------
export const organizations = pgTable("Organizations", {
	organizationId: uuid("organizationId").defaultRandom().primaryKey().notNull().$type<OrganizationId>(),
	name: text("name").notNull(),
	type: OrganizationTypeEnum("type").default('other').notNull(),
	// Free-form settings, e.g. display name for "unit" (school, department, team)
	settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
	...createdAndUpdatedAt,
},
	(table) => ({
		organization_name_key: uniqueIndex("Organization_name_key").on(table.name),
	}));
export type Organization = typeof organizations.$inferSelect;

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType() { return 'bytea'; } });

// The organization's logo, kept apart from Organizations so that ordinary organization queries never load the image bytes.
export const organizationLogos = pgTable("OrganizationLogos", {
	organizationId: uuid("organizationId").primaryKey().notNull().$type<OrganizationId>()
		.references(() => organizations.organizationId, { onDelete: "cascade", onUpdate: "cascade" }),
	data: bytea("data").notNull(),
	mimeType: text("mimeType").notNull(),
	// Bumped on every change so browsers fetch the new image instead of a cached one.
	version: integer("version").default(1).notNull(),
});

export const units = pgTable("Units", {
	unitId: uuid("unitId").defaultRandom().primaryKey().notNull().$type<UnitId>(),
	organizationId: uuid("organizationId").notNull().$type<OrganizationId>().references(() => organizations.organizationId, { onDelete: "cascade", onUpdate: "cascade" }),
	name: text("name").notNull(),
	...createdAndUpdatedAt,
},
	(table) => ({
		unit_name_per_org_key: uniqueIndex("Unit_name_per_org_key").on(table.organizationId, table.name),
		// Needed so other tables can reference (unitId, organizationId) and stay consistent
		unit_id_org_key: unique("Unit_id_org_key").on(table.unitId, table.organizationId),
	}));
export type Unit = typeof units.$inferSelect;

export const organizationMembers = pgTable("OrganizationMembers", {
	userId: uuid("userId").notNull().$type<UserId>().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	organizationId: uuid("organizationId").notNull().$type<OrganizationId>().references(() => organizations.organizationId, { onDelete: "cascade", onUpdate: "cascade" }),
	role: OrganizationRoleEnum("role").default('member').notNull(),
	...createdAndUpdatedAt,
},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.organizationId], name: "organization_members_pkey" }),
		org_idx: index("OrganizationMembers_org_idx").on(table.organizationId),
	}));

export const unitMembers = pgTable("UnitMembers", {
	userId: uuid("userId").notNull().$type<UserId>(),
	unitId: uuid("unitId").notNull().$type<UnitId>(),
	organizationId: uuid("organizationId").notNull().$type<OrganizationId>(),
	role: UnitRoleEnum("role").default('member').notNull(),
	...createdAndUpdatedAt,
},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.unitId], name: "unit_members_pkey" }),
		unit_idx: index("UnitMembers_unit_idx").on(table.unitId),
		// The unit must belong to the stated organization ...
		unit_fk: foreignKey({ columns: [table.unitId, table.organizationId], foreignColumns: [units.unitId, units.organizationId], name: "unit_members_unit_org_fkey" }).onDelete("cascade").onUpdate("cascade"),
		// ... and the user must be a member of that organization.
		org_member_fk: foreignKey({ columns: [table.userId, table.organizationId], foreignColumns: [organizationMembers.userId, organizationMembers.organizationId], name: "unit_members_org_member_fkey" }).onDelete("cascade").onUpdate("cascade"),
	}));

// A department (class, team, group) inside a unit. Organization > unit (e.g. a school) > department (e.g. a class).
export const departments = pgTable("Departments", {
	departmentId: uuid("departmentId").defaultRandom().primaryKey().notNull().$type<DepartmentId>(),
	unitId: uuid("unitId").notNull().$type<UnitId>(),
	organizationId: uuid("organizationId").notNull().$type<OrganizationId>(),
	name: text("name").notNull(),
	...createdAndUpdatedAt,
},
	(table) => ({
		department_name_per_unit_key: uniqueIndex("Department_name_per_unit_key").on(table.unitId, table.name),
		// Needed so DepartmentMembers can reference (departmentId, unitId) and stay consistent
		department_id_unit_key: unique("Department_id_unit_key").on(table.departmentId, table.unitId),
		unit_fk: foreignKey({ columns: [table.unitId, table.organizationId], foreignColumns: [units.unitId, units.organizationId], name: "departments_unit_org_fkey" }).onDelete("cascade").onUpdate("cascade"),
	}));

// Who is in a department. A person must already be a member of the department's unit.
export const departmentMembers = pgTable("DepartmentMembers", {
	departmentId: uuid("departmentId").notNull().$type<DepartmentId>(),
	userId: uuid("userId").notNull().$type<UserId>(),
	unitId: uuid("unitId").notNull().$type<UnitId>(),
	...createdAndUpdatedAt,
},
	(table) => ({
		pk: primaryKey({ columns: [table.departmentId, table.userId], name: "department_members_pkey" }),
		user_idx: index("DepartmentMembers_user_idx").on(table.userId),
		department_fk: foreignKey({ columns: [table.departmentId, table.unitId], foreignColumns: [departments.departmentId, departments.unitId], name: "department_members_department_fkey" }).onDelete("cascade").onUpdate("cascade"),
		unit_member_fk: foreignKey({ columns: [table.userId, table.unitId], foreignColumns: [unitMembers.userId, unitMembers.unitId], name: "department_members_unit_member_fkey" }).onDelete("cascade").onUpdate("cascade"),
	}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
	units: many(units),
	members: many(organizationMembers),
}));
export const unitsRelations = relations(units, ({ one, many }) => ({
	organization: one(organizations, { fields: [units.organizationId], references: [organizations.organizationId] }),
	members: many(unitMembers),
}));
export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
	user: one(users, { fields: [organizationMembers.userId], references: [users.userId] }),
	organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.organizationId] }),
}));
export const unitMembersRelations = relations(unitMembers, ({ one }) => ({
	user: one(users, { fields: [unitMembers.userId], references: [users.userId] }),
	unit: one(units, { fields: [unitMembers.unitId], references: [units.unitId] }),
}));

// ---------------------------------------------------------------------------
// Requests from prospective organizations (public form) and invitations to join.
// ---------------------------------------------------------------------------
export const organizationRequests = pgTable("OrganizationRequests", {
	requestId: uuid("requestId").defaultRandom().primaryKey().notNull(),
	organizationName: text("organizationName").notNull(),
	organizationType: OrganizationTypeEnum("organizationType").default('other').notNull(),
	contactName: text("contactName").notNull(),
	contactEmail: text("contactEmail").notNull(),
	expectedUsers: integer("expectedUsers"),
	message: text("message"),
	status: RequestStatusEnum("status").default('requested').notNull(),
	// Set when the request is approved
	createdOrganizationId: uuid("createdOrganizationId").$type<OrganizationId>().references(() => organizations.organizationId, { onDelete: "set null", onUpdate: "cascade" }),
	handledByUserId: uuid("handledByUserId").$type<UserId>().references(() => users.userId, { onDelete: "set null", onUpdate: "cascade" }),
	handledAt: timestamp("handledAt", { precision: 3, mode: 'date' }),
	...createdAndUpdatedAt,
},
	(table) => ({
		status_idx: index("OrganizationRequests_status_idx").on(table.status),
	}));

export const invitations = pgTable("Invitations", {
	invitationId: uuid("invitationId").defaultRandom().primaryKey().notNull(),
	// Only a hash of the secret code is stored. The code itself is shown once when the invitation is created.
	tokenHash: text("tokenHash").notNull(),
	organizationId: uuid("organizationId").notNull().$type<OrganizationId>().references(() => organizations.organizationId, { onDelete: "cascade", onUpdate: "cascade" }),
	unitId: uuid("unitId").$type<UnitId>(),
	organizationRole: OrganizationRoleEnum("organizationRole").default('member').notNull(),
	unitRole: UnitRoleEnum("unitRole").default('member').notNull(),
	// Free-text note for the inviter ("who is this for"). Not used for sending anything.
	note: text("note"),
	maxUses: integer("maxUses").default(1).notNull(),
	usedCount: integer("usedCount").default(0).notNull(),
	expiresAt: timestamp("expiresAt", { precision: 3, mode: 'date' }).notNull(),
	revokedAt: timestamp("revokedAt", { precision: 3, mode: 'date' }),
	createdByUserId: uuid("createdByUserId").$type<UserId>().references(() => users.userId, { onDelete: "set null", onUpdate: "cascade" }),
	...createdAndUpdatedAt,
},
	(table) => ({
		token_hash_key: uniqueIndex("Invitation_tokenHash_key").on(table.tokenHash),
		org_idx: index("Invitations_org_idx").on(table.organizationId),
		unit_org_fk: foreignKey({ columns: [table.unitId, table.organizationId], foreignColumns: [units.unitId, units.organizationId], name: "invitations_unit_org_fkey" }).onDelete("cascade").onUpdate("cascade"),
		uses_check: check("invitations_uses_check", sql`${table.usedCount} >= 0 AND ${table.usedCount} <= ${table.maxUses} AND ${table.maxUses} >= 1`),
	}));

// Shared columns/constraints for resources that can belong to an organization or a unit.
// Both null = personal resource owned by ownerUserId (the old behaviour).
const scopeConstraints = (table: { unitId: AnyPgColumn, organizationId: AnyPgColumn }, name: string) => ({
	[`${name}_unit_org_fkey`]: foreignKey({ columns: [table.unitId, table.organizationId], foreignColumns: [units.unitId, units.organizationId], name: `${name}_unit_org_fkey` }).onDelete("restrict").onUpdate("cascade"),
	[`${name}_unit_requires_org`]: check(`${name}_unit_requires_org`, sql`${table.unitId} IS NULL OR ${table.organizationId} IS NOT NULL`),
});
const scopeColumns = () => ({
	organizationId: uuid("organizationId").$type<OrganizationId>().references(() => organizations.organizationId, { onDelete: "restrict", onUpdate: "cascade" }),
	unitId: uuid("unitId").$type<UnitId>(),
});

export const PermissionTargetType = pgEnum("PermissionTargetType", ['stream', 'vrSpace'])
export const PermissionLevel = pgEnum("PermissionLevel", ['admin', 'edit', 'view'])

export const permissions = pgTable("Permissions", {
	userId: uuid("userId").notNull().$type<UserId>().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	targetType: PermissionTargetType("targetType").notNull(),
	targetId: uuid("targetId").notNull().$type<StreamId | VrSpaceId>(),
	permissionLevel: PermissionLevel("permissionLevel").default('view').notNull(),
},
	(table) => {
		return {
			userId_targetType_targetId_key: primaryKey({ columns: [table.userId, table.targetType, table.targetId], name: "permissions_pkey" }),
		}
	});

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
	description: text("description"),
	ownerUserId: uuid("ownerUserId").notNull().$type<UserId>().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	// doorsOpeningTime: timestamp("doorsOpeningTime", { precision: 3, mode: 'string' }),
	// doorsAutoOpen: boolean("doorsAutoOpen").default(false).notNull(),
	// doorsManuallyOpened: boolean("doorsManuallyOpened").default(false).notNull(),
	streamStartTime: timestamp("streamStartTime", { precision: 3, mode: 'date' }),
	streamAutoStart: boolean("streamAutoStart").default(false).notNull(),
	streamManuallyStarted: boolean("streamManuallyStarted").default(false).notNull(),
	streamManuallyEnded: boolean("streamManuallyEnded").default(false).notNull(),
	// extraSettings: jsonb("extraSettings"),
	visibility: VisibilityEnum("visibility").default('public').notNull(),
	mainCameraId: uuid("mainCameraId").references((): AnyPgColumn => cameras.cameraId).$type<CameraId>(),
	...scopeColumns(),
	// vrSpaceId: uuid("vrSpaceId").references((): AnyPgColumn => vrSpaces.vrSpaceId).$type<VrSpaceId>(),
	...createdAndUpdatedAt,
},
	(table) => {
		return {
			name_key: uniqueIndex("Stream_name_key").on(table.name),
			...scopeConstraints(table, "streams"),
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
	// vrSpace: one(vrSpaces, {
	// 	fields: [streams.vrSpaceId],
	// 	references: [vrSpaces.vrSpaceId],
	// }),
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
	cameraType: CameraTypeEnum("cameraType").default('panoramic360').notNull(),
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
	assetType: AssetTypeEnum("assetType").notNull(),
	originalFileName: text("originalFileName").notNull(),
	generatedName: text("generatedName").unique().notNull(),
	size: doublePrecision("size"),
	mimeType: text("mimeType"),
	showInUserLibrary: boolean("showInUserLibrary").default(true).notNull(),
	assetFileExtension: text("assetFileExtension").notNull().$type<AllFileExtensions>(),
	...scopeColumns(),
	ownerUserId: uuid("ownerUserId").notNull().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }).$type<UserId>(),
	// extraSettings: jsonb("extraSettings"),
	...createdAndUpdatedAt,
},
	(table) => ({
		...scopeConstraints(table, "assets"),
	}))

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
	name: text("name").notNull(),
	description: text("description"),
	ownerUserId: uuid("ownerUserId").notNull().$type<UserId>().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
	worldModelAssetId: uuid("worldModelAssetId").references(() => assets.assetId, { onDelete: 'set null' }).$type<AssetId>(),
	navMeshAssetId: uuid("navMeshAssetId").references(() => assets.assetId, { onDelete: 'set null' }).$type<AssetId>(),
	panoramicPreviewAssetId: uuid('panoramicPreview').references(() => assets.assetId, { onDelete: 'set null' }).$type<AssetId>(),
	visibility: VisibilityEnum("visibility").default('public').notNull(),
	worldModelScale: doublePrecision("worldModelScale").default(1).notNull(),
	// NOTE: A bug in drizzle generates invalid SQL migrations for arrays of 
	// double precision (double precision uses space in sql and this leads to incorrect quoteing).
	// Workaround for now is to use real
	spawnPosition: real("spawnPosition").array().$type<NumberTuble3>(),
	spawnRadius: doublePrecision("spawnRadius"),
	skyColor: text("skyColor"),
	// Opt-in: show this space in the public guest gallery (only effective while visibility is public/unlisted).
	listedInGallery: boolean("listedInGallery").default(false).notNull(),
	...scopeColumns(),
	...createdAndUpdatedAt,
},
	(table) => ({
		...scopeConstraints(table, "vr_spaces"),
	}));

export const vrSpacesRelations = relations(vrSpaces, ({ one, many }) => ({
	owner: one(users, {
		fields: [vrSpaces.ownerUserId],
		references: [users.userId],
	}),
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

type NumberTuble3 = [number, number, number];
type NumberTuble4 = [number, number, number, number];
export const placedObjects = pgTable("PlacedObjects", {
	placedObjectId: uuid("placedObjectId").defaultRandom().primaryKey().notNull().$type<PlacedObjectId>(),
	vrSpaceId: uuid("vrSpaceId").notNull().references(() => vrSpaces.vrSpaceId, { onDelete: "cascade", onUpdate: "cascade" }).$type<VrSpaceId>(),
	// assetId: uuid("assetId").references(() => Asset.assetId, { onDelete: "cascade", onUpdate: "cascade" }),
	// vrPortalId: uuid("vrPortalId").references(() => VrPortal.portalId, { onDelete: "cascade", onUpdate: "cascade" }),

	// Lets try polymorphism!!!
	// NOTE: Because of this design choice, we have to manually handle all delete cascades :-(
	// In practice. anywhere we delete vrSpace/asset/stream, we need to manually delete all placedObjects targetting it
	type: PlacedObjectTypeEnum("type").notNull(),
	objectId: uuid('objectId').$type<AssetId | VrSpaceId | StreamId>(),
	objectSettings: jsonb("objectSettings"),
	position: real("position").array().notNull().$type<NumberTuble3>(),
	orientation: real("orientation").array().$type<NumberTuble4>(),
	scale: real("scale").array().$type<NumberTuble3>(),
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