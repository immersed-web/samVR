-- ALTER TABLE "public"."Users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
-- DROP TYPE "public"."Role";--> statement-breakpoint
-- CREATE TYPE "public"."Role" AS ENUM('god', 'superadmin', 'admin', 'moderator', 'user', 'guest');--> statement-breakpoint
-- ALTER TABLE "public"."Users" ALTER COLUMN "role" SET DATA TYPE "public"."Role" USING "role"::"public"."Role";


ALTER TYPE "public"."Role" RENAME VALUE 'gunnar' TO 'god';