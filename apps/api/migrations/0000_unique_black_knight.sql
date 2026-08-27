CREATE TABLE "audit_logs" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"correlation_id" uuid,
	"payload" jsonb NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_aggregate_id_occurred_at_idx" ON "audit_logs" USING btree ("aggregate_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_occurred_at_idx" ON "audit_logs" USING btree ("actor_id","occurred_at");