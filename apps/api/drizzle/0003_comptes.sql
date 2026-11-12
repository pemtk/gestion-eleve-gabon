ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "institutional_users" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "institutional_users" ADD CONSTRAINT "institutional_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutional_users" ADD CONSTRAINT "institutional_users_user_id_unique" UNIQUE("user_id");