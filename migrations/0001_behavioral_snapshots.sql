CREATE TABLE "agent_behavioral_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"chain" text DEFAULT 'base' NOT NULL,
	"scan_date" timestamp DEFAULT now() NOT NULL,
	"bot_activity_score" integer,
	"reaction_consistency_score" integer,
	"gas_consistency_score" integer,
	"decision_pattern_score" integer,
	"overall_authenticity_score" integer,
	"activity_pattern" text,
	"reaction_pattern" text,
	"gas_pattern" text,
	"decision_pattern" text,
	"verdict" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "snapshots_wallet_date_idx" ON "agent_behavioral_snapshots" ("wallet_address", "scan_date" DESC);
