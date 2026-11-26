CREATE TYPE "public"."OrganizationRole" AS ENUM('org_admin', 'member', 'basic');--> statement-breakpoint
CREATE TYPE "public"."OrganizationType" AS ENUM('municipality', 'company', 'other');--> statement-breakpoint
CREATE TYPE "public"."RequestStatus" AS ENUM('requested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."UnitRole" AS ENUM('unit_admin', 'member');--> statement-breakpoint
ALTER TYPE "public"."Visibility" ADD VALUE 'organization';--> statement-breakpoint
ALTER TYPE "public"."Visibility" ADD VALUE 'unit';--> statement-breakpoint
CREATE TABLE "DepartmentMembers" (
	"departmentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"unitId" uuid NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "department_members_pkey" PRIMARY KEY("departmentId","userId")
);
--> statement-breakpoint
CREATE TABLE "Departments" (
	"departmentId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unitId" uuid NOT NULL,
	"organizationId" uuid NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "Department_id_unit_key" UNIQUE("departmentId","unitId")
);
--> statement-breakpoint
CREATE TABLE "Invitations" (
	"invitationId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tokenHash" text NOT NULL,
	"organizationId" uuid NOT NULL,
	"unitId" uuid,
	"organizationRole" "OrganizationRole" DEFAULT 'member' NOT NULL,
	"unitRole" "UnitRole" DEFAULT 'member' NOT NULL,
	"note" text,
	"maxUses" integer DEFAULT 1 NOT NULL,
	"usedCount" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"revokedAt" timestamp (3),
	"createdByUserId" uuid,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "invitations_uses_check" CHECK ("Invitations"."usedCount" >= 0 AND "Invitations"."usedCount" <= "Invitations"."maxUses" AND "Invitations"."maxUses" >= 1)
);
--> statement-breakpoint
CREATE TABLE "OrganizationLogos" (
	"organizationId" uuid PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"mimeType" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OrganizationMembers" (
	"userId" uuid NOT NULL,
	"organizationId" uuid NOT NULL,
	"role" "OrganizationRole" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "organization_members_pkey" PRIMARY KEY("userId","organizationId")
);
--> statement-breakpoint
CREATE TABLE "OrganizationRequests" (
	"requestId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationName" text NOT NULL,
	"organizationType" "OrganizationType" DEFAULT 'other' NOT NULL,
	"contactName" text NOT NULL,
	"contactEmail" text NOT NULL,
	"expectedUsers" integer,
	"message" text,
	"status" "RequestStatus" DEFAULT 'requested' NOT NULL,
	"createdOrganizationId" uuid,
	"handledByUserId" uuid,
	"handledAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Organizations" (
	"organizationId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "OrganizationType" DEFAULT 'other' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "UnitMembers" (
	"userId" uuid NOT NULL,
	"unitId" uuid NOT NULL,
	"organizationId" uuid NOT NULL,
	"role" "UnitRole" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "unit_members_pkey" PRIMARY KEY("userId","unitId")
);
--> statement-breakpoint
CREATE TABLE "Units" (
	"unitId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" uuid NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now(),
	"updatedAt" timestamp (3),
	CONSTRAINT "Unit_id_org_key" UNIQUE("unitId","organizationId")
);
--> statement-breakpoint
CREATE TABLE "UserMessages" (
	"messageId" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"fromUserId" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"readAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "Assets" ADD COLUMN "organizationId" uuid;--> statement-breakpoint
ALTER TABLE "Assets" ADD COLUMN "unitId" uuid;--> statement-breakpoint
ALTER TABLE "Streams" ADD COLUMN "organizationId" uuid;--> statement-breakpoint
ALTER TABLE "Streams" ADD COLUMN "unitId" uuid;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "blockedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "blockedReason" text;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "lastLoginAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD COLUMN "listedInGallery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD COLUMN "organizationId" uuid;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD COLUMN "unitId" uuid;--> statement-breakpoint
ALTER TABLE "DepartmentMembers" ADD CONSTRAINT "department_members_department_fkey" FOREIGN KEY ("departmentId","unitId") REFERENCES "public"."Departments"("departmentId","unitId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "DepartmentMembers" ADD CONSTRAINT "department_members_unit_member_fkey" FOREIGN KEY ("userId","unitId") REFERENCES "public"."UnitMembers"("userId","unitId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Departments" ADD CONSTRAINT "departments_unit_org_fkey" FOREIGN KEY ("unitId","organizationId") REFERENCES "public"."Units"("unitId","organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invitations" ADD CONSTRAINT "Invitations_organizationId_Organizations_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invitations" ADD CONSTRAINT "Invitations_createdByUserId_Users_userId_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."Users"("userId") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invitations" ADD CONSTRAINT "invitations_unit_org_fkey" FOREIGN KEY ("unitId","organizationId") REFERENCES "public"."Units"("unitId","organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationLogos" ADD CONSTRAINT "OrganizationLogos_organizationId_Organizations_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationMembers" ADD CONSTRAINT "OrganizationMembers_userId_Users_userId_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("userId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationMembers" ADD CONSTRAINT "OrganizationMembers_organizationId_Organizations_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationRequests" ADD CONSTRAINT "OrganizationRequests_createdOrganizationId_Organizations_organizationId_fk" FOREIGN KEY ("createdOrganizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationRequests" ADD CONSTRAINT "OrganizationRequests_handledByUserId_Users_userId_fk" FOREIGN KEY ("handledByUserId") REFERENCES "public"."Users"("userId") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UnitMembers" ADD CONSTRAINT "unit_members_unit_org_fkey" FOREIGN KEY ("unitId","organizationId") REFERENCES "public"."Units"("unitId","organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UnitMembers" ADD CONSTRAINT "unit_members_org_member_fkey" FOREIGN KEY ("userId","organizationId") REFERENCES "public"."OrganizationMembers"("userId","organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Units" ADD CONSTRAINT "Units_organizationId_Organizations_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserMessages" ADD CONSTRAINT "UserMessages_userId_Users_userId_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("userId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserMessages" ADD CONSTRAINT "UserMessages_fromUserId_Users_userId_fk" FOREIGN KEY ("fromUserId") REFERENCES "public"."Users"("userId") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "DepartmentMembers_user_idx" ON "DepartmentMembers" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Department_name_per_unit_key" ON "Departments" USING btree ("unitId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitations" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "Invitations_org_idx" ON "Invitations" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "OrganizationMembers_org_idx" ON "OrganizationMembers" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "OrganizationRequests_status_idx" ON "OrganizationRequests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "Organization_name_key" ON "Organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "UnitMembers_unit_idx" ON "UnitMembers" USING btree ("unitId");--> statement-breakpoint
CREATE UNIQUE INDEX "Unit_name_per_org_key" ON "Units" USING btree ("organizationId","name");--> statement-breakpoint
CREATE INDEX "UserMessages_user_created_idx" ON "UserMessages" USING btree ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "Assets" ADD CONSTRAINT "Assets_organizationId_Organizations_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Assets" ADD CONSTRAINT "assets_unit_org_fkey" FOREIGN KEY ("unitId","organizationId") REFERENCES "public"."Units"("unitId","organizationId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Streams" ADD CONSTRAINT "Streams_organizationId_Organizations_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Streams" ADD CONSTRAINT "streams_unit_org_fkey" FOREIGN KEY ("unitId","organizationId") REFERENCES "public"."Units"("unitId","organizationId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD CONSTRAINT "VrSpaces_organizationId_Organizations_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."Organizations"("organizationId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD CONSTRAINT "vr_spaces_unit_org_fkey" FOREIGN KEY ("unitId","organizationId") REFERENCES "public"."Units"("unitId","organizationId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Assets" ADD CONSTRAINT "assets_unit_requires_org" CHECK ("Assets"."unitId" IS NULL OR "Assets"."organizationId" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "Streams" ADD CONSTRAINT "streams_unit_requires_org" CHECK ("Streams"."unitId" IS NULL OR "Streams"."organizationId" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "VrSpaces" ADD CONSTRAINT "vr_spaces_unit_requires_org" CHECK ("VrSpaces"."unitId" IS NULL OR "VrSpaces"."organizationId" IS NOT NULL);