-- Refonte du modèle « espace enseignant » : tâches par classe et par élève, évaluations et notes, appel comme source
-- unique des absences. Les anciennes lignes de `tasks`, `assignments` et `attendance_records` n'ont ni classe ni identifiant
-- exploitables : elles sont vidées (aucune donnée de production n'existait avant cette version ; la démonstration se recharge
-- au démarrage avec SEED_DEMO).
TRUNCATE TABLE "tasks", "assignments", "attendance_records" CASCADE;--> statement-breakpoint
CREATE SEQUENCE "public"."case_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 300 CACHE 1;--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_id" text NOT NULL,
	"subject" text NOT NULL,
	"trimester" text NOT NULL,
	"label" text NOT NULL,
	"coefficient" integer DEFAULT 1 NOT NULL,
	"held_on" text NOT NULL,
	"teacher_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"grade_id" integer NOT NULL,
	"from_value" real NOT NULL,
	"to_value" real NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"evaluation_id" text NOT NULL,
	"student_id" text NOT NULL,
	"value" real NOT NULL,
	"comment" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_subjects" (
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"coefficient" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "school_subjects_school_id_name_pk" PRIMARY KEY("school_id","name")
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"task_id" text NOT NULL,
	"student_id" text NOT NULL,
	"status" text NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"evaluation" text,
	"proof" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	CONSTRAINT "task_completions_task_id_student_id_pk" PRIMARY KEY("task_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "absences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "result_corrections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "results" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subject_grades" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_invalidations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "absences" CASCADE;--> statement-breakpoint
DROP TABLE "result_corrections" CASCADE;--> statement-breakpoint
DROP TABLE "results" CASCADE;--> statement-breakpoint
DROP TABLE "subject_grades" CASCADE;--> statement-breakpoint
DROP TABLE "task_invalidations" CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_class_id_date_student_id_pk";--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "author_id" text;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "class_id" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "teacher_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "class_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "taken_by" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "student_id" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "reporter_id" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "kind" text DEFAULT 'confidentiel' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "class_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "teacher_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "require_photo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "graded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "user_id" text;--> statement-breakpoint
-- La clé étrangère composite des affectations exige cette contrainte d'unicité : elle doit exister avant.
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_id_school_uq" UNIQUE("id","school_id");
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_class_same_school_fk" FOREIGN KEY ("class_id","school_id") REFERENCES "public"."classes"("id","school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_corrections" ADD CONSTRAINT "grade_corrections_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_class_subject_term_label_uq" ON "evaluations" USING btree ("class_id","subject","trimester","label");--> statement-breakpoint
CREATE INDEX "evaluations_school_idx" ON "evaluations" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grades_evaluation_student_uq" ON "grades" USING btree ("evaluation_id","student_id");--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_same_school_fk" FOREIGN KEY ("teacher_id","school_id") REFERENCES "public"."teachers"("id","school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_same_school_fk" FOREIGN KEY ("class_id","school_id") REFERENCES "public"."classes"("id","school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_class_same_school_fk" FOREIGN KEY ("class_id","school_id") REFERENCES "public"."classes"("id","school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_class_same_school_fk" FOREIGN KEY ("class_id","school_id") REFERENCES "public"."classes"("id","school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_teacher_class_subject_uq" ON "assignments" USING btree ("teacher_id","class_id","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_class_date_student_uq" ON "attendance_records" USING btree ("class_id","date","student_id");--> statement-breakpoint
CREATE INDEX "attendance_school_date_idx" ON "attendance_records" USING btree ("school_id","date");--> statement-breakpoint
CREATE INDEX "tasks_class_idx" ON "tasks" USING btree ("class_id");--> statement-breakpoint
ALTER TABLE "assignments" DROP COLUMN "teacher";--> statement-breakpoint
ALTER TABLE "assignments" DROP COLUMN "class_name";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "teachers" DROP COLUMN "assignments";--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_unique" UNIQUE("user_id");