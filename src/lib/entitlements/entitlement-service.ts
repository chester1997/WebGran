import { db } from '@/db';
import { 
  users, 
  subscriptions, 
  subscriptionPlans, 
  features, 
  planFeatures, 
  sellerFeatureOverrides 
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export type FeatureType = 'BOOLEAN' | 'LIMIT' | 'QUOTA';
export type EntitlementSource = 
  | 'ADMIN_EXEMPT' 
  | 'OVERRIDE' 
  | 'PLAN' 
  | 'DEFAULT' 
  | 'INACTIVE' 
  | 'NOT_FOUND';

export interface EntitlementResult<T = any> {
  featureKey: string;
  type: FeatureType;
  value: T;
  source: EntitlementSource;
  isUnlimited: boolean;
  overrideReason?: string | null;
  expiresAt?: Date | null;
}

export interface LimitCheckResult {
  allowed: boolean;
  limit: number | null; // null indicates unlimited
  usage: number;
  remaining: number | null; // null indicates unlimited
  isUnlimited: boolean;
  source: EntitlementSource;
}

function parseValue(val: any): any {
  if (val !== null && typeof val === 'object' && 'value' in val) {
    return val.value;
  }
  return val;
}

/**
  Main resolution engine enforcing precedence:
  1. ADMIN / SUPER_ADMIN -> Unlimited / Allowed (ADMIN_EXEMPT)
  2. Active seller override -> (OVERRIDE)
  3. Seller subscription plan feature -> (PLAN)
  4. Global feature default -> (DEFAULT)
  5. Inactive / Missing feature -> (INACTIVE / NOT_FOUND)
 */
export async function getSellerEntitlement<T = any>(
  sellerId: string,
  featureKey: string
): Promise<EntitlementResult<T>> {
  // 1. Check if user is ADMIN / SUPER_ADMIN (Exempt)
  const user = await db.query.users.findFirst({
    where: eq(users.id, sellerId),
  });

  const roleUpper = (user?.role || '').toUpperCase();
  if (user && (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN')) {
    return {
      featureKey,
      type: 'LIMIT',
      value: -1 as unknown as T,
      source: 'ADMIN_EXEMPT',
      isUnlimited: true,
    };
  }

  // 2. Fetch Feature definition
  const feature = await db.query.features.findFirst({
    where: eq(features.key, featureKey),
  });

  if (!feature) {
    return {
      featureKey,
      type: 'BOOLEAN',
      value: false as unknown as T,
      source: 'NOT_FOUND',
      isUnlimited: false,
    };
  }

  if (!feature.isActive) {
    return {
      featureKey,
      type: feature.type as FeatureType,
      value: (feature.type === 'BOOLEAN' ? false : 0) as unknown as T,
      source: 'INACTIVE',
      isUnlimited: false,
    };
  }

  const featureType = feature.type as FeatureType;

  // 3. Check Subscription Status & Precedence
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.sellerId, sellerId),
    orderBy: [desc(subscriptions.createdAt)],
  });

  const now = new Date();
  let statusUpper = (sub?.status || '').toUpperCase();
  const periodEndMs = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0;

  // Evaluate dynamic status transition based on period expiration
  if (statusUpper === 'TRIAL' && periodEndMs > 0 && periodEndMs <= now.getTime()) {
    statusUpper = 'EXPIRED';
  } else if (statusUpper === 'ACTIVE' && periodEndMs > 0 && periodEndMs <= now.getTime()) {
    statusUpper = 'PAST_DUE';
  }

  const INACTIVE_STATUSES = ['PAST_DUE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'];
  const isSubInactive = Boolean(sub && INACTIVE_STATUSES.includes(statusUpper));

  // If subscription is NOT inactive (i.e. ACTIVE, TRIAL, or new seller), evaluate Overrides and Plan Features
  if (!isSubInactive) {
    // Check for Active Override
    const override = await db.query.sellerFeatureOverrides.findFirst({
      where: and(
        eq(sellerFeatureOverrides.sellerId, sellerId),
        eq(sellerFeatureOverrides.featureId, feature.id)
      ),
    });

    if (override) {
      const isExpired = override.expiresAt && new Date(override.expiresAt) <= now;

      if (!isExpired) {
        const rawVal = parseValue(override.overrideValue);
        const isUnlimited = rawVal === -1 || rawVal === Infinity;

        return {
          featureKey,
          type: featureType,
          value: rawVal as T,
          source: 'OVERRIDE',
          isUnlimited,
          overrideReason: override.reason,
          expiresAt: override.expiresAt ? new Date(override.expiresAt) : null,
        };
      }
    }

    // Check Plan Feature via Seller Subscription
    if (sub && sub.planId) {
      const planFeat = await db.query.planFeatures.findFirst({
        where: and(
          eq(planFeatures.planId, sub.planId),
          eq(planFeatures.featureId, feature.id)
        ),
      });

      if (planFeat) {
        const rawVal = parseValue(planFeat.value);
        const isUnlimited = rawVal === -1 || rawVal === Infinity;

        return {
          featureKey,
          type: featureType,
          value: rawVal as T,
          source: 'PLAN',
          isUnlimited,
        };
      }
    }
  }

  // 4. Fallback to Global Default (for inactive subscriptions or unconfigured features)
  const rawDefault = parseValue(feature.defaultValue);
  const isUnlimited = rawDefault === -1 || rawDefault === Infinity;

  return {
    featureKey,
    type: featureType,
    value: rawDefault as T,
    source: 'DEFAULT',
    isUnlimited,
  };
}

export async function getSellerFeature(sellerId: string, featureKey: string): Promise<EntitlementResult> {
  return getSellerEntitlement(sellerId, featureKey);
}

export async function hasFeature(sellerId: string, featureKey: string): Promise<boolean> {
  const res = await getSellerEntitlement(sellerId, featureKey);
  if (res.source === 'ADMIN_EXEMPT') return true;
  if (res.source === 'INACTIVE' || res.source === 'NOT_FOUND') return false;
  return Boolean(res.value);
}

export async function getSellerLimit(sellerId: string, featureKey: string): Promise<number | null> {
  const res = await getSellerEntitlement(sellerId, featureKey);
  if (res.source === 'ADMIN_EXEMPT' || res.isUnlimited) return null;
  if (res.source === 'INACTIVE' || res.source === 'NOT_FOUND') return 0;
  const num = Number(res.value);
  return num === -1 ? null : (isNaN(num) ? 0 : num);
}

export async function getSellerQuota(sellerId: string, featureKey: string): Promise<number | null> {
  return getSellerLimit(sellerId, featureKey);
}

export async function checkLimit(
  sellerId: string,
  featureKey: string,
  currentUsage: number
): Promise<LimitCheckResult> {
  const entitlement = await getSellerEntitlement(sellerId, featureKey);

  if (entitlement.source === 'ADMIN_EXEMPT' || entitlement.isUnlimited) {
    return {
      allowed: true,
      limit: null,
      usage: currentUsage,
      remaining: null,
      isUnlimited: true,
      source: entitlement.source,
    };
  }

  if (entitlement.source === 'INACTIVE' || entitlement.source === 'NOT_FOUND') {
    return {
      allowed: false,
      limit: 0,
      usage: currentUsage,
      remaining: 0,
      isUnlimited: false,
      source: entitlement.source,
    };
  }

  const limitNum = typeof entitlement.value === 'number' ? entitlement.value : Number(entitlement.value) || 0;

  if (limitNum === -1) {
    return {
      allowed: true,
      limit: null,
      usage: currentUsage,
      remaining: null,
      isUnlimited: true,
      source: entitlement.source,
    };
  }

  const remaining = Math.max(0, limitNum - currentUsage);
  const allowed = currentUsage < limitNum;

  return {
    allowed,
    limit: limitNum,
    usage: currentUsage,
    remaining,
    isUnlimited: false,
    source: entitlement.source,
  };
}

/**
  Admin Override Utility Functions
 */
export async function setSellerOverride(params: {
  sellerId: string;
  featureKey: string;
  overrideValue: any;
  reason?: string;
  expiresAt?: Date | null;
  createdBy?: string;
}) {
  const feature = await db.query.features.findFirst({
    where: eq(features.key, params.featureKey),
  });

  if (!feature) {
    throw new Error(`Feature '${params.featureKey}' não encontrada.`);
  }

  const valueFormatted = typeof params.overrideValue === 'object' && params.overrideValue !== null && 'value' in params.overrideValue
    ? params.overrideValue
    : { value: params.overrideValue };

  const existing = await db.query.sellerFeatureOverrides.findFirst({
    where: and(
      eq(sellerFeatureOverrides.sellerId, params.sellerId),
      eq(sellerFeatureOverrides.featureId, feature.id)
    ),
  });

  const now = new Date();

  if (existing) {
    await db
      .update(sellerFeatureOverrides)
      .set({
        overrideValue: valueFormatted,
        reason: params.reason || null,
        expiresAt: params.expiresAt || null,
        createdBy: params.createdBy || null,
        updatedAt: now,
      })
      .where(eq(sellerFeatureOverrides.id, existing.id));
  } else {
    await db.insert(sellerFeatureOverrides).values({
      sellerId: params.sellerId,
      featureId: feature.id,
      overrideValue: valueFormatted,
      reason: params.reason || null,
      expiresAt: params.expiresAt || null,
      createdBy: params.createdBy || null,
    });
  }
}

export async function removeSellerOverride(sellerId: string, featureKey: string) {
  const feature = await db.query.features.findFirst({
    where: eq(features.key, featureKey),
  });

  if (!feature) return;

  await db
    .delete(sellerFeatureOverrides)
    .where(and(
      eq(sellerFeatureOverrides.sellerId, sellerId),
      eq(sellerFeatureOverrides.featureId, feature.id)
    ));
}
