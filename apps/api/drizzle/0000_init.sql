CREATE TABLE "absences" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"student" text NOT NULL,
	"class_name" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"justification" text
);
--> statement-breakpoint
CREATE TABLE "alert_prefs" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"label" text NOT NULL,
	"on" boolean NOT NULL,
	CONSTRAINT "alert_prefs_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"audience" text NOT NULL,
	"target" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"teacher" text NOT NULL,
	"class_name" text NOT NULL,
	"subject" text NOT NULL,
	"year" text NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"school_id" text NOT NULL,
	"class_id" text NOT NULL,
	"date" text NOT NULL,
	"student_id" text NOT NULL,
	"status" text NOT NULL,
	"justification" text,
	CONSTRAINT "attendance_records_class_id_date_student_id_pk" PRIMARY KEY("class_id","date","student_id")
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"reporter" text NOT NULL,
	"class_name" text NOT NULL,
	"type" text NOT NULL,
	"received" text NOT NULL,
	"student" text NOT NULL,
	"text" text NOT NULL,
	"step" integer DEFAULT 1 NOT NULL,
	"gravity" text,
	"measures" text DEFAULT '' NOT NULL,
	"inform_director" boolean DEFAULT false NOT NULL,
	"inform_family" boolean DEFAULT false NOT NULL,
	"summary" text,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"capacity" integer NOT NULL,
	"student_count" integer DEFAULT 0 NOT NULL,
	"completion" integer DEFAULT 0 NOT NULL,
	"alert" text,
	CONSTRAINT "classes_id_school_uq" UNIQUE("id","school_id")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"icon" text NOT NULL,
	"title" text NOT NULL,
	"when" text NOT NULL,
	"tone" text NOT NULL,
	"status" text NOT NULL,
	"meta" text NOT NULL,
	"description" text NOT NULL,
	"table" jsonb NOT NULL,
	"action" text NOT NULL,
	"action_icon" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutional_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"scope" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner" (
	"user_id" text PRIMARY KEY NOT NULL,
	"points" integer NOT NULL,
	"streak" integer NOT NULL,
	"done_today" integer NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_requests" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"parent" text NOT NULL,
	"relation" text NOT NULL,
	"child" text NOT NULL,
	"meta" text NOT NULL,
	"decision" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"client_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"text" text,
	"image" boolean DEFAULT false NOT NULL,
	"time" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"user_id" text NOT NULL,
	"notification_id" text NOT NULL,
	CONSTRAINT "notification_reads_user_id_notification_id_pk" PRIMARY KEY("user_id","notification_id")
);
--> statement-breakpoint
CREATE TABLE "org_subscriptions" (
	"org_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"period" text DEFAULT 'annuelle' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"requested_plan" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"due" text DEFAULT '' NOT NULL,
	"parent_id" text
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"phone" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"from_value" real NOT NULL,
	"to_value" real NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"student" text NOT NULL,
	"value" real,
	"coefficient" integer DEFAULT 1 NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"label" text NOT NULL,
	"threshold" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_years" (
	"school_id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"terms" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"school_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "settings_school_id_key_pk" PRIMARY KEY("school_id","key")
);
--> statement-breakpoint
CREATE TABLE "student_parents" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"name" text NOT NULL,
	"relation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"class_id" text NOT NULL,
	"phone" text,
	"code" text NOT NULL,
	"activated" boolean DEFAULT false NOT NULL,
	"sms_sent" boolean DEFAULT false NOT NULL,
	CONSTRAINT "students_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subject_grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"average" real NOT NULL,
	"coefficient" integer NOT NULL,
	"notes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_invalidations" (
	"task_id" text NOT NULL,
	"student_index" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_invalidations_task_id_student_index_pk" PRIMARY KEY("task_id","student_index")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"type" text NOT NULL,
	"due" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"estimate" text DEFAULT '—' NOT NULL,
	"position" serial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"assignments" text DEFAULT '' NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"school_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"initials" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"last" text NOT NULL,
	"time" text NOT NULL,
	"unread" integer DEFAULT 0 NOT NULL,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "user_scopes" (
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	CONSTRAINT "user_scopes_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"role" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"organization" text,
	"password_hash" text NOT NULL,
	"activated" boolean DEFAULT false NOT NULL,
	"school_id" text,
	"photo_visibility" text DEFAULT 'school' NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "visit_reports" (
	"school_id" text NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"school" text NOT NULL,
	"date" text NOT NULL,
	"text" text NOT NULL,
	"visible_to_school" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_requests" ADD CONSTRAINT "link_requests_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_corrections" ADD CONSTRAINT "result_corrections_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_same_school_fk" FOREIGN KEY ("class_id","school_id") REFERENCES "public"."classes"("id","school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_reports" ADD CONSTRAINT "visit_reports_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absences_school_idx" ON "absences" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "cases_school_idx" ON "cases" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_school_name_uq" ON "classes" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_thread_client_uq" ON "messages" USING btree ("thread_id","client_id");--> statement-breakpoint
CREATE INDEX "students_school_idx" ON "students" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "tasks_school_idx" ON "tasks" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "teachers_school_idx" ON "teachers" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "threads_school_idx" ON "threads" USING btree ("school_id","role");--> statement-breakpoint
CREATE INDEX "users_school_idx" ON "users" USING btree ("school_id");