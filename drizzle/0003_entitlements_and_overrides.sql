CREATE TABLE IF NOT EXISTS "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"default_value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "features_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "plan_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_features_plan_id_feature_id_unique" UNIQUE("plan_id","feature_id")
);

CREATE TABLE IF NOT EXISTS "seller_feature_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"override_value" jsonb NOT NULL,
	"reason" text,
	"expires_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seller_feature_overrides_seller_id_feature_id_unique" UNIQUE("seller_id","feature_id")
);

DO $$ BEGIN
 ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "seller_feature_overrides" ADD CONSTRAINT "seller_feature_overrides_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "seller_feature_overrides" ADD CONSTRAINT "seller_feature_overrides_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "seller_feature_overrides" ADD CONSTRAINT "seller_feature_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "plan_features_plan_idx" ON "plan_features" ("plan_id");
CREATE INDEX IF NOT EXISTS "plan_features_feature_idx" ON "plan_features" ("feature_id");
CREATE INDEX IF NOT EXISTS "seller_feature_overrides_seller_idx" ON "seller_feature_overrides" ("seller_id");
CREATE INDEX IF NOT EXISTS "seller_feature_overrides_feature_idx" ON "seller_feature_overrides" ("feature_id");
