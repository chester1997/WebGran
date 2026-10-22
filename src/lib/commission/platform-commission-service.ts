import { db } from '@/db';
import { platformCommissionSettings, platformCommissionAuditLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { ensureCommissionSettings } from '@/db/ensure-commission-settings';

export interface CommissionSettingsResponse {
  feeCents: number;
  feeReais: number;
  formattedFee: string;
  updatedAt: Date;
  updatedByName: string | null;
  updatedByEmail: string | null;
}

export interface CommissionAuditLogItem {
  id: string;
  previousFeeCents: number;
  newFeeCents: number;
  previousFeeReais: number;
  newFeeReais: number;
  changedByName: string | null;
  changedByEmail: string | null;
  reason: string | null;
  createdAt: Date;
}

export class PlatformCommissionService {
  public static readonly DEFAULT_FEE_CENTS = 50;

  /**
   * Retrieves the current platform commission setting safely.
   * Falls back to DEFAULT_FEE_CENTS (50 cents / R$ 0,50) if table or database is unavailable.
   */
  static async getCurrentCommission(): Promise<CommissionSettingsResponse> {
    try {
      await ensureCommissionSettings();

      if (!db?.query?.platformCommissionSettings?.findFirst) {
        const defaultReais = PlatformCommissionService.DEFAULT_FEE_CENTS / 100;
        return {
          feeCents: PlatformCommissionService.DEFAULT_FEE_CENTS,
          feeReais: defaultReais,
          formattedFee: `R$ ${defaultReais.toFixed(2).replace('.', ',')}`,
          updatedAt: new Date(),
          updatedByName: 'PADRÃO_SISTEMA',
          updatedByEmail: null,
        };
      }

      const setting = await db.query.platformCommissionSettings.findFirst({
        orderBy: [desc(platformCommissionSettings.updatedAt)],
      });

      if (setting && typeof setting.feeCents === 'number' && !isNaN(setting.feeCents)) {
        const feeCents = Math.round(setting.feeCents);
        const feeReais = feeCents / 100;
        return {
          feeCents,
          feeReais,
          formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
          updatedAt: setting.updatedAt ? new Date(setting.updatedAt) : new Date(),
          updatedByName: setting.updatedByName || null,
          updatedByEmail: setting.updatedByEmail || null,
        };
      }
    } catch (err) {
      console.warn('[PlatformCommissionService] Error fetching commission settings, using default:', err);
    }

    const defaultReais = PlatformCommissionService.DEFAULT_FEE_CENTS / 100;
    return {
      feeCents: PlatformCommissionService.DEFAULT_FEE_CENTS,
      feeReais: defaultReais,
      formattedFee: `R$ ${defaultReais.toFixed(2).replace('.', ',')}`,
      updatedAt: new Date(),
      updatedByName: 'PADRÃO_SISTEMA',
      updatedByEmail: null,
    };
  }

  /**
   * Quick helper returning just the current commission integer in cents.
   */
  static async getCurrentCommissionCents(): Promise<number> {
    const comm = await this.getCurrentCommission();
    return comm.feeCents;
  }

  /**
   * Updates platform commission and records an immutable audit log entry.
   * Only authorized administrators should call this method.
   */
  static async updateCommission(
    newFeeCents: number,
    adminUser: { id: string; name?: string | null; email?: string | null },
    reason?: string
  ): Promise<CommissionSettingsResponse> {
    // 1. Rigorous validation of integer cents
    if (typeof newFeeCents !== 'number' || isNaN(newFeeCents) || !Number.isInteger(newFeeCents)) {
      throw new Error('O valor da comissão deve ser um número inteiro de centavos válido.');
    }

    if (newFeeCents < 0) {
      throw new Error('O valor da comissão não pode ser negativo.');
    }

    if (newFeeCents > 100000) {
      // Security cap: R$ 1.000,00 per sale
      throw new Error('O valor da comissão não pode exceder R$ 1.000,00 por venda.');
    }

    await ensureCommissionSettings();

    // 2. Read previous value
    const current = await this.getCurrentCommission();
    const previousFeeCents = current.feeCents;

    // 3. Upsert / update platform_commission_settings
    const existing = await db.query.platformCommissionSettings.findFirst({
      orderBy: [desc(platformCommissionSettings.updatedAt)],
    });

    const now = new Date();
    if (existing) {
      await db
        .update(platformCommissionSettings)
        .set({
          feeCents: newFeeCents,
          updatedAt: now,
          updatedById: adminUser.id,
          updatedByName: adminUser.name || 'Administrador',
          updatedByEmail: adminUser.email || null,
        })
        .where(eq(platformCommissionSettings.id, existing.id));
    } else {
      await db.insert(platformCommissionSettings).values({
        feeCents: newFeeCents,
        updatedAt: now,
        updatedById: adminUser.id,
        updatedByName: adminUser.name || 'Administrador',
        updatedByEmail: adminUser.email || null,
      });
    }

    // 4. Record audit log
    try {
      await db.insert(platformCommissionAuditLogs).values({
        previousFeeCents,
        newFeeCents,
        changedById: adminUser.id,
        changedByName: adminUser.name || 'Administrador',
        changedByEmail: adminUser.email || null,
        reason: reason?.trim() || null,
        createdAt: now,
      });
    } catch (auditErr) {
      console.error('[PlatformCommissionService] Failed to record audit log:', auditErr);
    }

    const feeReais = newFeeCents / 100;
    return {
      feeCents: newFeeCents,
      feeReais,
      formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
      updatedAt: now,
      updatedByName: adminUser.name || 'Administrador',
      updatedByEmail: adminUser.email || null,
    };
  }

  /**
   * Retrieves audit log history.
   */
  static async getAuditHistory(limit = 20): Promise<CommissionAuditLogItem[]> {
    try {
      await ensureCommissionSettings();

      const logs = await db.query.platformCommissionAuditLogs.findMany({
        orderBy: [desc(platformCommissionAuditLogs.createdAt)],
        limit,
      });

      return logs.map((l) => ({
        id: l.id,
        previousFeeCents: l.previousFeeCents,
        newFeeCents: l.newFeeCents,
        previousFeeReais: l.previousFeeCents / 100,
        newFeeReais: l.newFeeCents / 100,
        changedByName: l.changedByName,
        changedByEmail: l.changedByEmail,
        reason: l.reason,
        createdAt: new Date(l.createdAt),
      }));
    } catch (err) {
      console.warn('[PlatformCommissionService] Error fetching audit logs:', err);
      return [];
    }
  }
}
