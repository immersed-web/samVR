CREATE TYPE "public"."AssetType" AS ENUM('image', 'video', 'model', 'navmesh', 'document');--> statement-breakpoint
CREATE TYPE "public"."CameraType" AS ENUM('panoramic360', 'normal');--> statement-breakpoint
CREATE TYPE "public"."PermissionLevel" AS ENUM('admin', 'edit', 'view');--> statement-breakpoint
CREATE TYPE "public"."PermissionTargetType" AS ENUM('stream', 'vrSpace');--> statement-breakpoint
CREATE TYPE "public"."PlacedObjectType" AS ENUM('asset', 'vrPortal', 'streamPortal', 'externalLinkPortal', 'pointLight', 'directionalLight', 'ambientLight');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('gunnar', 'superadmin', 'admin', 'moderator', 'user', 'guest');--> statement-breakpoint
CREATE TYPE "public"."Visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TABLE "Assets" (
	"assetId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assetType" "AssetType" NOT NULL,
	"originalFileName" text NOT NULL,
	"generatedName" text NOT NULL,
	"size" double precision,
	"mimeType" text,
	"showInUserLibrary" boolean DEFAULT true NOT NULL,
	"assetFileExtension" text NOT NULL,
	"ownerUserId" uuid NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "Assets_generatedName_unique" UNIQUE("generatedName")
);
--> statement-breakpoint
CREATE TABLE "CameraPortals" (
	"fromCameraId" uuid NOT NULL,
	"toCameraId" uuid NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"distance" double precision NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "cameraPortals_pkey" PRIMARY KEY("fromCameraId","toCameraId")
);
--> statement-breakpoint
CREATE TABLE "Cameras" (
	"cameraId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"streamId" uuid NOT NULL,
	"senderId" uuid,
	"cameraType" "CameraType" DEFAULT 'panoramic360' NOT NULL,
	"viewOriginX" double precision DEFAULT 0.5 NOT NULL,
	"viewOriginY" double precision DEFAULT 0.5 NOT NULL,
	"fovStart" double precision DEFAULT 0 NOT NULL,
	"fovEnd" double precision DEFAULT 1 NOT NULL,
	"orientation" double precision DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Permissions" (
	"userId" uuid NOT NULL,
	"targetType" "PermissionTargetType" NOT NULL,
	"targetId" uuid NOT NULL,
	"permissionLevel" "PermissionLevel" DEFAULT 'view' NOT NULL,
	CONSTRAINT "permissions_pkey" PRIMARY KEY("userId","targetType","targetId")
);
--> statement-breakpoint
CREATE TABLE "PlacedObjects" (
	"placedObjectId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vrSpaceId" uuid NOT NULL,
	"type" "PlacedObjectType" NOT NULL,
	"objectId" uuid,
	"objectSettings" jsonb,
	"position" real[] NOT NULL,
	"orientation" real[],
	"scale" real[],
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Streams" (
	"streamId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ownerUserId" uuid NOT NULL,
	"streamStartTime" timestamp (3),
	"streamAutoStart" boolean DEFAULT false NOT NULL,
	"streamManuallyStarted" boolean DEFAULT false NOT NULL,
	"streamManuallyEnded" boolean DEFAULT false NOT NULL,
	"visibility" "Visibility" DEFAULT 'public' NOT NULL,
	"mainCameraId" uuid,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Users" (
	"userId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" "Role" DEFAULT 'user' NOT NULL,
	"avatarDesign" json
);
--> statement-breakpoint
CREATE TABLE "VrSpaces" (
	"vrSpaceId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ownerUserId" uuid NOT NULL,
	"worldModelAssetId" uuid,
	"navMeshAssetId" uuid,
	"panoramicPreview" uuid,
	"visibility" "Visibility" DEFAULT 'public' NOT NULL,
	"worldModelScale" double precision DEFAULT 1 NOT NULL,
	"spawnPosition" real[],
	"spawnRadius" double precision,
	"skyColor" text,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "Assets" ADD CONSTRAINT "Assets_ownerUserId_Users_userId_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."Users"("userId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CameraPortals" ADD CONSTRAINT "CameraPortals_fromCameraId_Cameras_cameraId_fk" FOREIGN KEY ("fromCameraId") REFERENCES "public"."Cameras"("cameraId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CameraPortals" ADD CONSTRAINT "CameraPortals_toCameraId_Cameras_cameraId_fk" FOREIGN KEY ("toCameraId") REFERENCES "public"."Cameras"("cameraId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Cameras" ADD CONSTRAINT "Cameras_streamId_Streams_streamId_fk" FOREIGN KEY ("streamId") REFERENCES "public"."Streams"("streamId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Permissions" ADD CONSTRAINT "Permissions_userId_Users_userId_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("userId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PlacedObjects" ADD CONSTRAINT "PlacedObjects_vrSpaceId_VrSpaces_vrSpaceId_fk" FOREIGN KEY ("vrSpaceId") REFERENCES "public"."VrSpaces"("vrSpaceId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Streams" ADD CONSTRAINT "Streams_ownerUserId_Users_userId_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."Users"("userId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Streams" ADD CONSTRAINT "Streams_mainCameraId_Cameras_cameraId_fk" FOREIGN KEY ("mainCameraId") REFERENCES "public"."Cameras"("cameraId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD CONSTRAINT "VrSpaces_ownerUserId_Users_userId_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."Users"("userId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD CONSTRAINT "VrSpaces_worldModelAssetId_Assets_assetId_fk" FOREIGN KEY ("worldModelAssetId") REFERENCES "public"."Assets"("assetId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD CONSTRAINT "VrSpaces_navMeshAssetId_Assets_assetId_fk" FOREIGN KEY ("navMeshAssetId") REFERENCES "public"."Assets"("assetId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD CONSTRAINT "VrSpaces_panoramicPreview_Assets_assetId_fk" FOREIGN KEY ("panoramicPreview") REFERENCES "public"."Assets"("assetId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cameras_name_streamId_key" ON "Cameras" USING btree ("name","streamId");--> statement-breakpoint
CREATE UNIQUE INDEX "cameras_senderId_streamId_key" ON "Cameras" USING btree ("streamId","senderId");--> statement-breakpoint
CREATE UNIQUE INDEX "Session_sid_key" ON "session" USING btree ("sid");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "Stream_name_key" ON "Streams" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "User_username_key" ON "Users" USING btree ("username");