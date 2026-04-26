CREATE TABLE "agent_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" text NOT NULL,
	"verdict" text,
	"source" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_scan_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"agent_name" text NOT NULL,
	"wallet" text,
	"chain" text DEFAULT 'base' NOT NULL,
	"twitter_handle" text,
	"social_link" text,
	"logs_url" text,
	"claimed_abilities" text,
	"result_json" jsonb NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_scan_results_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flagged_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"chain" text DEFAULT 'ethereum' NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"risk_level" text NOT NULL,
	"top_category" text,
	"apol_verdict" text NOT NULL,
	"reports" jsonb DEFAULT '[]'::jsonb,
	"flagged_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "flagged_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "hero_nominations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"nominated_by" integer NOT NULL,
	"evidence_url" text,
	"wallet_address" text,
	"votes" integer DEFAULT 0 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scam_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reported_by" integer NOT NULL,
	"scam_type" text NOT NULL,
	"evidence_url" text,
	"evidence_image" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_lookups" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"token_name" text,
	"token_symbol" text,
	"lookup_count" integer DEFAULT 1 NOT NULL,
	"last_scanned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scan_lookups_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_user_id" text,
	"wallet_address" text,
	"tx_hash" text NOT NULL,
	"from_address" text,
	"amount_wei" text NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "subscriptions_telegram_user_id_unique" UNIQUE("telegram_user_id"),
	CONSTRAINT "subscriptions_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "used_payment_tx_hashes" (
	"tx_hash" text PRIMARY KEY NOT NULL,
	"telegram_user_id" text,
	"wallet_address" text,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_name" text NOT NULL,
	"token_ticker" text NOT NULL,
	"contract_address" text NOT NULL,
	"website" text NOT NULL,
	"tx_hash" text NOT NULL,
	"wallet_address" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"rejection_reason" text,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"vote_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
