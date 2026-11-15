CREATE TABLE "badge_awards" (
	"student_id" text NOT NULL,
	"school_id" text NOT NULL,
	"badge_id" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badge_awards_student_id_badge_id_pk" PRIMARY KEY("student_id","badge_id")
);
--> statement-breakpoint
DROP TABLE "learner" CASCADE;--> statement-breakpoint
ALTER TABLE "badge_awards" ADD CONSTRAINT "badge_awards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_awards" ADD CONSTRAINT "badge_awards_school_id_organizations_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;