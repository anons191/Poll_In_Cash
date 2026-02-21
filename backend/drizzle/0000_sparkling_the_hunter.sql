CREATE TYPE "public"."payout_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."poll_status" AS ENUM('draft', 'active', 'closed', 'distributed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_destination" AS ENUM('wallet', 'cashapp', 'venmo', 'bank');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"verified_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reliability_score" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"polls_completed" integer DEFAULT 0 NOT NULL,
	"total_earned_usdc" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"recipient_wallet" text NOT NULL,
	"amount_usdc" numeric(18, 6) NOT NULL,
	"tx_hash" text,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"distributed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "poll_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"agent_wallet" text NOT NULL,
	"responses" jsonb NOT NULL,
	"confidence_scores" jsonb,
	"attestation_hash" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"contract_poll_id" integer,
	"title" text NOT NULL,
	"description" text,
	"questions" jsonb NOT NULL,
	"criteria" jsonb NOT NULL,
	"criteria_hash" text NOT NULL,
	"cash_pool_usdc" numeric(18, 6) NOT NULL,
	"participant_cap" integer NOT NULL,
	"status" "poll_status" DEFAULT 'draft' NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_wallet" text NOT NULL,
	"destination_type" "withdrawal_destination" NOT NULL,
	"destination_address" text NOT NULL,
	"destination_handle" text,
	"amount_usdc" numeric(18, 6) NOT NULL,
	"fee_usdc" numeric(18, 6) DEFAULT '0' NOT NULL,
	"tx_hash" text,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_profiles_user_id_idx" ON "agent_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_nonces_wallet_address_idx" ON "auth_nonces" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "auth_nonces_nonce_idx" ON "auth_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "payouts_poll_id_idx" ON "payouts" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "payouts_recipient_wallet_idx" ON "payouts" USING btree ("recipient_wallet");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "poll_responses_poll_id_idx" ON "poll_responses" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_responses_agent_wallet_idx" ON "poll_responses" USING btree ("agent_wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_responses_poll_agent_unique" ON "poll_responses" USING btree ("poll_id","agent_wallet");--> statement-breakpoint
CREATE INDEX "polls_creator_id_idx" ON "polls" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "polls_status_idx" ON "polls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "polls_contract_poll_id_idx" ON "polls" USING btree ("contract_poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_wallet_address_idx" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "withdrawals_agent_wallet_idx" ON "withdrawals" USING btree ("agent_wallet");--> statement-breakpoint
CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawals_requested_at_idx" ON "withdrawals" USING btree ("requested_at");