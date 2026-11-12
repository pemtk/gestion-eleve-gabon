CREATE TABLE "work_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"seconds" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_requests" ADD COLUMN "student_id" text;--> statement-breakpoint
ALTER TABLE "link_requests" ADD COLUMN "parent_user_id" text;--> statement-breakpoint
ALTER TABLE "student_parents" ADD COLUMN "parent_user_id" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "work_sessions_user_idx" ON "work_sessions" USING btree ("user_id","at");--> statement-breakpoint
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_parents_student_user_uq" ON "student_parents" USING btree ("student_id","parent_user_id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_unique" UNIQUE("user_id");