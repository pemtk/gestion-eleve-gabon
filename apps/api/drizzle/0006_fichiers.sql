CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "attachment_file_id" text;--> statement-breakpoint
ALTER TABLE "task_completions" ADD COLUMN "proof_file_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_file_id" text;--> statement-breakpoint
ALTER TABLE "visit_reports" ADD COLUMN "attachment_file_id" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "files_school_idx" ON "files" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "files_pending_idx" ON "files" USING btree ("status","created_at");