export type ProductDurationType = 
  | 'daily' | 'DAILY'
  | 'weekly' | 'WEEKLY'
  | 'biweekly' | 'BIWEEKLY'
  | 'monthly' | 'MONTHLY'
  | 'quarterly' | 'QUARTERLY'
  | 'semiannual' | 'SEMIANNUAL'
  | 'annual' | 'ANNUAL' | 'yearly' | 'YEARLY'
  | 'lifetime' | 'LIFETIME';

/**
 * Pure date utility: Calculates the backend access expiration date.
 * Client-safe (no DB dependencies).
 */
export function calculateAccessExpiration(
  duration: string | null | undefined,
  paidAt?: Date | string | null
): Date | null {
  if (!duration) return null;

  const normalized = duration.trim().toLowerCase();
  if (normalized === 'lifetime' || normalized === 'vitalicio' || normalized === 'vitalício') {
    return null;
  }

  const start = paidAt ? new Date(paidAt) : new Date();
  const result = new Date(start);

  switch (normalized) {
    case 'daily':
    case 'diario':
    case 'diário':
      result.setDate(result.getDate() + 1);
      return result;

    case 'weekly':
    case 'semanal':
      result.setDate(result.getDate() + 7);
      return result;

    case 'biweekly':
    case 'quinzena':
    case 'quinzenal':
      result.setDate(result.getDate() + 14);
      return result;

    case 'monthly':
    case 'mensal': {
      const currentMonth = result.getMonth();
      result.setMonth(currentMonth + 1);
      if (result.getMonth() !== (currentMonth + 1) % 12) {
        result.setDate(0);
      }
      return result;
    }

    case 'quarterly':
    case 'trimestral': {
      const currentMonth = result.getMonth();
      result.setMonth(currentMonth + 3);
      if (result.getMonth() !== (currentMonth + 3) % 12) {
        result.setDate(0);
      }
      return result;
    }

    case 'semiannual':
    case 'semestral': {
      const currentMonth = result.getMonth();
      result.setMonth(currentMonth + 6);
      if (result.getMonth() !== (currentMonth + 6) % 12) {
        result.setDate(0);
      }
      return result;
    }

    case 'annual':
    case 'yearly':
    case 'anual': {
      result.setFullYear(result.getFullYear() + 1);
      return result;
    }

    default:
      return null;
  }
}

/**
 * Pure UI utility: Formats access expiration details for BR UI rendering.
 * Client-safe (no DB dependencies).
 */
export function formatAccessExpirationBR(expiresAt: Date | string | null, status?: string) {
  if (!expiresAt) {
    return {
      isLifetime: true,
      isExpired: false,
      dateFormatted: "Acesso vitalício",
      daysRemaining: null,
      badgeText: "Acesso vitalício",
      badgeType: "LIFETIME" as const
    };
  }

  const expDate = new Date(expiresAt);
  const now = new Date();
  const day = String(expDate.getDate()).padStart(2, '0');
  const month = String(expDate.getMonth() + 1).padStart(2, '0');
  const year = expDate.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = status === 'EXPIRED' || diffMs <= 0;

  if (isExpired) {
    return {
      isLifetime: false,
      isExpired: true,
      dateFormatted: `Expirou em ${dateStr}`,
      daysRemaining: 0,
      badgeText: `Expirou em ${dateStr}`,
      badgeType: "EXPIRED" as const
    };
  }

  return {
    isLifetime: false,
    isExpired: false,
    dateFormatted: `Expira em ${dateStr}`,
    daysRemaining: diffDays > 0 ? diffDays : 0,
    badgeText: `Expira em ${dateStr}`,
    badgeType: "ACTIVE" as const
  };
}
