import { db } from '@/db';
import { sellerCommissionSettings, sellerCommissionAuditLogs } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { PlatformCommissionService, PlatformCommissionUnavailableError } from '@/lib/commission/platform-commission-service';
import { BUSINESS_TIMEZONE } from '@/lib/analytics/timezone-utils';

export type ExemptionStatus = 'NONE' | 'PENDING' | 'ACTIVE' | 'EXPIRED';
export type FeeResolutionSource = 'PLATFORM_DEFAULT' | 'CUSTOM' | 'EXEMPTION';

export interface EffectiveFeeResult {
  sellerId: string;
  effectiveFeeCents: number;
  effectiveFeeReais: number;
  formattedFee: string;
  source: FeeResolutionSource;
  isExempt: boolean;
  customFeeCents: number | null;
  platformDefaultFeeCents: number;
  exemption: {
    status: ExemptionStatus;
    isActive: boolean;
    start: Date | null;
    end: Date | null;
    reason: string | null;
  };
  referenceDate: Date;
}

export interface SellerCommissionSettingsDTO {
  id: string;
  sellerId: string;
  customFeeCents: number | null;
  exemptionActive: boolean;
  exemptionStart: Date | null;
  exemptionEnd: Date | null;
  exemptionReason: string | null;
  version: number;
  updatedAt: Date;
  updatedById: string | null;
  updatedByName: string | null;
  updatedByEmail: string | null;
}

export interface UpdateSellerCommissionInput {
  sellerId: string;
  customFeeCents?: number | null;
  exemptionActive?: boolean;
  exemptionStart?: Date | string | null;
  exemptionEnd?: Date | string | null;
  exemptionReason?: string | null;
  expectedVersion?: number;
  reason: string;
  adminUser: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

export interface SellerCommissionAuditLogDTO {
  id: string;
  sellerId: string;
  previousFeeCents: number | null;
  newFeeCents: number | null;
  previousExemptionActive: boolean;
  newExemptionActive: boolean;
  previousExemptionStart: Date | null;
  previousExemptionEnd: Date | null;
  newExemptionStart: Date | null;
  newExemptionEnd: Date | null;
  reason: string;
  changedById: string | null;
  changedByName: string | null;
  changedByEmail: string | null;
  createdAt: Date;
}

export class SellerCommissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SellerCommissionValidationError';
  }
}

export class SellerCommissionConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SellerCommissionConcurrencyError';
  }
}

/**
 * Parses dates representing calendar instants in America/Recife (UTC-3)
 * and produces consistent UTC Date objects.
 */
export function parseRecifeToUTC(dateInput: Date | string | null | undefined): Date | null {
  if (dateInput === null || dateInput === undefined) {
    return null;
  }

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      throw new SellerCommissionValidationError('Data inválida fornecida.');
    }
    return new Date(dateInput.getTime());
  }

  if (typeof dateInput !== 'string') {
    throw new SellerCommissionValidationError('Formato de data inválido.');
  }

  const str = dateInput.trim();
  if (!str) {
    return null;
  }

  // 1. Civil date only: "YYYY-MM-DD" -> assume midnight in America/Recife (UTC-3)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00-03:00`);
    if (isNaN(d.getTime())) {
      throw new SellerCommissionValidationError(`Data inválida fornecida: "${str}".`);
    }
    return d;
  }

  // 2. Date + time without timezone offset: "YYYY-MM-DDTHH:mm(:ss)?"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(str)) {
    const d = new Date(`${str}-03:00`);
    if (isNaN(d.getTime())) {
      throw new SellerCommissionValidationError(`Data e hora inválidas fornecidas: "${str}".`);
    }
    return d;
  }

  // 3. String with timezone indicator ("Z" or "[+-]HH:mm")
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new SellerCommissionValidationError(`Formato de data e hora inválido ou não reconhecido: "${str}".`);
  }
  return d;
}

export class SellerCommissionService {
  /**
   * Validates custom fee in cents.
   * Allowed: null (inherit platform default) or integer between 0 and 50.
   */
  static validateFeeCents(cents: unknown): number | null {
    if (cents === null || cents === undefined) {
      return null;
    }

    if (typeof cents !== 'number' || isNaN(cents)) {
      throw new SellerCommissionValidationError('O valor da taxa deve ser um número válido.');
    }

    if (!Number.isInteger(cents)) {
      throw new SellerCommissionValidationError('A taxa personalizada deve ser um valor inteiro em centavos, sem frações.');
    }

    if (cents < 0) {
      throw new SellerCommissionValidationError('A taxa não pode ser negativa.');
    }

    if (cents > 50) {
      throw new SellerCommissionValidationError('A taxa não pode exceder 50 centavos (R$ 0,50).');
    }

    return cents;
  }

  /**
   * Resolves the effective commission fee for a seller at a specific instant.
   * 
   * Precedence and Rules:
   * 1. Without individual configuration: inherit platform default fee (R$ 0,50).
   * 2. Custom fee of 0 cents: permanent zero fee, not confused with NULL.
   * 3. Temporary exemption active: zero fee only when referenceDate >= start AND referenceDate < end.
   * 4. Future exemption (referenceDate < start): applies custom fee or platform default until start.
   * 5. Expired exemption (referenceDate >= end): automatically returns to custom fee or platform default.
   * 6. No reliance on cron jobs.
   * 
   * @param sellerId The unique ID of the seller
   * @param referenceDate Instant of calculation (defaults to now)
   */
  static async resolveEffectiveFee(
    sellerId: string,
    referenceDate: Date = new Date()
  ): Promise<EffectiveFeeResult> {
    if (!sellerId || typeof sellerId !== 'string') {
      throw new SellerCommissionValidationError('Identificador do vendedor é obrigatório.');
    }

    const ref = new Date(referenceDate.getTime());
    if (isNaN(ref.getTime())) {
      throw new SellerCommissionValidationError('Data de referência inválida para resolução de taxa.');
    }

    // 1. Fetch individual seller configuration
    const setting = db.query?.sellerCommissionSettings
      ? await db.query.sellerCommissionSettings.findFirst({
          where: eq(sellerCommissionSettings.sellerId, sellerId),
        })
      : null;

    const hasCustomFee = Boolean(setting && setting.customFeeCents !== null && setting.customFeeCents !== undefined);

    // 2. Resolve platform default fee (single source of truth)
    let platformDefaultFeeCents = PlatformCommissionService.DEFAULT_FEE_CENTS;
    if ((db as any).query?.platformCommissionSettings?.findFirst) {
      try {
        platformDefaultFeeCents = await PlatformCommissionService.getCurrentCommissionCents();
      } catch (err: any) {
        if (!hasCustomFee && !setting?.exemptionActive) {
          throw err;
        }
        platformDefaultFeeCents = PlatformCommissionService.DEFAULT_FEE_CENTS;
      }
    }

    // 2.1 No individual configuration -> use platform default
    if (!setting) {
      const feeReais = platformDefaultFeeCents / 100;
      return {
        sellerId,
        effectiveFeeCents: platformDefaultFeeCents,
        effectiveFeeReais: feeReais,
        formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
        source: 'PLATFORM_DEFAULT',
        isExempt: false,
        customFeeCents: null,
        platformDefaultFeeCents,
        exemption: {
          status: 'NONE',
          isActive: false,
          start: null,
          end: null,
          reason: null,
        },
        referenceDate: ref,
      };
    }

    // Base fee when exemption is not active:
    // Notice: customFeeCents === 0 is valid and distinct from null!
    const baseFeeCents = hasCustomFee ? setting.customFeeCents! : platformDefaultFeeCents;
    const baseSource: FeeResolutionSource = hasCustomFee ? 'CUSTOM' : 'PLATFORM_DEFAULT';

    // 2.2 Evaluate temporary exemption
    if (setting.exemptionActive) {
      const start = setting.exemptionStart ? new Date(setting.exemptionStart) : null;
      const end = setting.exemptionEnd ? new Date(setting.exemptionEnd) : null;

      if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const refTime = ref.getTime();
        const startTime = start.getTime();
        const endTime = end.getTime();

        if (refTime < startTime) {
          // Future exemption: not active yet, keep custom/default fee
          const feeReais = baseFeeCents / 100;
          return {
            sellerId,
            effectiveFeeCents: baseFeeCents,
            effectiveFeeReais: feeReais,
            formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
            source: baseSource,
            isExempt: false,
            customFeeCents: setting.customFeeCents,
            platformDefaultFeeCents,
            exemption: {
              status: 'PENDING',
              isActive: false,
              start,
              end,
              reason: setting.exemptionReason,
            },
            referenceDate: ref,
          };
        } else if (refTime >= startTime && refTime < endTime) {
          // Inclusivo no início, exclusivo no término: Isenção ativa!
          return {
            sellerId,
            effectiveFeeCents: 0,
            effectiveFeeReais: 0.0,
            formattedFee: 'R$ 0,00',
            source: 'EXEMPTION',
            isExempt: true,
            customFeeCents: setting.customFeeCents,
            platformDefaultFeeCents,
            exemption: {
              status: 'ACTIVE',
              isActive: true,
              start,
              end,
              reason: setting.exemptionReason,
            },
            referenceDate: ref,
          };
        } else {
          // Expired exemption: automatically reverts to base fee
          const feeReais = baseFeeCents / 100;
          return {
            sellerId,
            effectiveFeeCents: baseFeeCents,
            effectiveFeeReais: feeReais,
            formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
            source: baseSource,
            isExempt: false,
            customFeeCents: setting.customFeeCents,
            platformDefaultFeeCents,
            exemption: {
              status: 'EXPIRED',
              isActive: false,
              start,
              end,
              reason: setting.exemptionReason,
            },
            referenceDate: ref,
          };
        }
      }
    }

    // 2.3 Exemption not active: apply base fee (custom or default)
    const feeReais = baseFeeCents / 100;
    return {
      sellerId,
      effectiveFeeCents: baseFeeCents,
      effectiveFeeReais: feeReais,
      formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
      source: baseSource,
      isExempt: false,
      customFeeCents: setting.customFeeCents,
      platformDefaultFeeCents,
      exemption: {
        status: 'NONE',
        isActive: false,
        start: setting.exemptionStart ? new Date(setting.exemptionStart) : null,
        end: setting.exemptionEnd ? new Date(setting.exemptionEnd) : null,
        reason: setting.exemptionReason,
      },
      referenceDate: ref,
    };
  }

  /**
   * Updates a seller's fee configuration and records an audit log entry in the same transaction.
   * Protects against concurrent modifications using versioning.
   */
  static async updateSellerCommission(
    input: UpdateSellerCommissionInput
  ): Promise<SellerCommissionSettingsDTO> {
    if (!input.sellerId || typeof input.sellerId !== 'string') {
      throw new SellerCommissionValidationError('Identificador do vendedor é obrigatório.');
    }

    if (!input.reason || typeof input.reason !== 'string' || !input.reason.trim()) {
      throw new SellerCommissionValidationError('A justificativa da alteração é obrigatória.');
    }

    if (!input.adminUser?.id || typeof input.adminUser.id !== 'string') {
      throw new SellerCommissionValidationError('Identificação do administrador responsável é obrigatória.');
    }

    // Validate fee cents
    const validatedFeeCents = this.validateFeeCents(input.customFeeCents);

    // Validate and parse exemption dates
    const exemptionActive = Boolean(input.exemptionActive);
    let parsedStart: Date | null = null;
    let parsedEnd: Date | null = null;
    let exemptionReason: string | null = null;

    if (exemptionActive) {
      parsedStart = parseRecifeToUTC(input.exemptionStart);
      parsedEnd = parseRecifeToUTC(input.exemptionEnd);

      if (!parsedStart) {
        throw new SellerCommissionValidationError('Data de início da isenção é obrigatória quando a isenção está ativa.');
      }

      if (!parsedEnd) {
        throw new SellerCommissionValidationError('Data de término da isenção é obrigatória quando a isenção está ativa.');
      }

      if (parsedEnd.getTime() <= parsedStart.getTime()) {
        throw new SellerCommissionValidationError('A data de término da isenção deve ser posterior à data de início.');
      }

      if (!input.exemptionReason || typeof input.exemptionReason !== 'string' || !input.exemptionReason.trim()) {
        throw new SellerCommissionValidationError('A justificativa para a isenção temporária é obrigatória.');
      }
      exemptionReason = input.exemptionReason.trim();
    } else {
      parsedStart = parseRecifeToUTC(input.exemptionStart);
      parsedEnd = parseRecifeToUTC(input.exemptionEnd);
      exemptionReason = typeof input.exemptionReason === 'string' ? input.exemptionReason.trim() || null : null;
      if (parsedStart && parsedEnd && parsedEnd.getTime() <= parsedStart.getTime()) {
        throw new SellerCommissionValidationError('A data de término da isenção deve ser posterior à data de início.');
      }
    }

    const now = new Date();

    return await db.transaction(async (tx) => {
      // 1. Read existing record
      const existing = await tx.query.sellerCommissionSettings.findFirst({
        where: eq(sellerCommissionSettings.sellerId, input.sellerId),
      });

      // 2. Concurrency checks
      if (existing) {
        if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
          throw new SellerCommissionConcurrencyError(
            `Conflito de concorrência: a taxa deste vendedor foi modificada recentemente por outro administrador (versão esperada: ${input.expectedVersion}, versão atual: ${existing.version}). Recarregue os dados e tente novamente.`
          );
        }
      } else {
        if (input.expectedVersion !== undefined && input.expectedVersion !== 0) {
          throw new SellerCommissionConcurrencyError(
            `Conflito de concorrência: esperava-se registro existente na versão ${input.expectedVersion}, mas nenhuma taxa configurada foi encontrada para o vendedor.`
          );
        }
      }

      let savedSetting: typeof sellerCommissionSettings.$inferSelect;

      if (existing) {
        const [updated] = await tx
          .update(sellerCommissionSettings)
          .set({
            customFeeCents: validatedFeeCents,
            exemptionActive,
            exemptionStart: parsedStart,
            exemptionEnd: parsedEnd,
            exemptionReason,
            version: sql`${sellerCommissionSettings.version} + 1`,
            updatedAt: now,
            updatedById: input.adminUser.id,
            updatedByName: input.adminUser.name || null,
            updatedByEmail: input.adminUser.email || null,
          })
          .where(
            and(
              eq(sellerCommissionSettings.sellerId, input.sellerId),
              eq(sellerCommissionSettings.version, existing.version)
            )
          )
          .returning();

        if (!updated) {
          throw new SellerCommissionConcurrencyError(
            'Conflito de concorrência detectado durante a gravação da taxa do vendedor.'
          );
        }
        savedSetting = updated;
      } else {
        const [inserted] = await tx
          .insert(sellerCommissionSettings)
          .values({
            sellerId: input.sellerId,
            customFeeCents: validatedFeeCents,
            exemptionActive,
            exemptionStart: parsedStart,
            exemptionEnd: parsedEnd,
            exemptionReason,
            version: 1,
            updatedAt: now,
            updatedById: input.adminUser.id,
            updatedByName: input.adminUser.name || null,
            updatedByEmail: input.adminUser.email || null,
          })
          .returning();

        savedSetting = inserted;
      }

      // 3. Insert audit log record in SAME transaction
      await tx.insert(sellerCommissionAuditLogs).values({
        sellerId: input.sellerId,
        previousFeeCents: existing?.customFeeCents ?? null,
        newFeeCents: savedSetting.customFeeCents,
        previousExemptionActive: existing?.exemptionActive ?? false,
        newExemptionActive: savedSetting.exemptionActive,
        previousExemptionStart: existing?.exemptionStart ?? null,
        previousExemptionEnd: existing?.exemptionEnd ?? null,
        newExemptionStart: savedSetting.exemptionStart,
        newExemptionEnd: savedSetting.exemptionEnd,
        reason: input.reason.trim(),
        changedById: input.adminUser.id,
        changedByName: input.adminUser.name || null,
        changedByEmail: input.adminUser.email || null,
        createdAt: now,
      });

      return {
        id: savedSetting.id,
        sellerId: savedSetting.sellerId,
        customFeeCents: savedSetting.customFeeCents,
        exemptionActive: savedSetting.exemptionActive,
        exemptionStart: savedSetting.exemptionStart ? new Date(savedSetting.exemptionStart) : null,
        exemptionEnd: savedSetting.exemptionEnd ? new Date(savedSetting.exemptionEnd) : null,
        exemptionReason: savedSetting.exemptionReason,
        version: savedSetting.version,
        updatedAt: new Date(savedSetting.updatedAt),
        updatedById: savedSetting.updatedById,
        updatedByName: savedSetting.updatedByName,
        updatedByEmail: savedSetting.updatedByEmail,
      };
    });
  }

  /**
   * Retrieves the current commission configuration for a seller, or null if none configured.
   */
  static async getSellerCommissionSetting(
    sellerId: string
  ): Promise<SellerCommissionSettingsDTO | null> {
    if (!db.query?.sellerCommissionSettings) return null;
    const setting = await db.query.sellerCommissionSettings.findFirst({
      where: eq(sellerCommissionSettings.sellerId, sellerId),
    });

    if (!setting) return null;

    return {
      id: setting.id,
      sellerId: setting.sellerId,
      customFeeCents: setting.customFeeCents,
      exemptionActive: setting.exemptionActive,
      exemptionStart: setting.exemptionStart ? new Date(setting.exemptionStart) : null,
      exemptionEnd: setting.exemptionEnd ? new Date(setting.exemptionEnd) : null,
      exemptionReason: setting.exemptionReason,
      version: setting.version,
      updatedAt: new Date(setting.updatedAt),
      updatedById: setting.updatedById,
      updatedByName: setting.updatedByName,
      updatedByEmail: setting.updatedByEmail,
    };
  }

  /**
   * Retrieves the immutable audit log history for a seller.
   */
  static async getSellerCommissionHistory(
    sellerId: string
  ): Promise<SellerCommissionAuditLogDTO[]> {
    if (!db.query?.sellerCommissionAuditLogs) return [];
    const logs = await db.query.sellerCommissionAuditLogs.findMany({
      where: eq(sellerCommissionAuditLogs.sellerId, sellerId),
      orderBy: [desc(sellerCommissionAuditLogs.createdAt)],
    });

    return logs.map((log) => ({
      id: log.id,
      sellerId: log.sellerId,
      previousFeeCents: log.previousFeeCents,
      newFeeCents: log.newFeeCents,
      previousExemptionActive: log.previousExemptionActive,
      newExemptionActive: log.newExemptionActive,
      previousExemptionStart: log.previousExemptionStart ? new Date(log.previousExemptionStart) : null,
      previousExemptionEnd: log.previousExemptionEnd ? new Date(log.previousExemptionEnd) : null,
      newExemptionStart: log.newExemptionStart ? new Date(log.newExemptionStart) : null,
      newExemptionEnd: log.newExemptionEnd ? new Date(log.newExemptionEnd) : null,
      reason: log.reason,
      changedById: log.changedById,
      changedByName: log.changedByName,
      changedByEmail: log.changedByEmail,
      createdAt: new Date(log.createdAt),
    }));
  }
}

