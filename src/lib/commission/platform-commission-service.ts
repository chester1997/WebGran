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

export class PlatformCommissionUnavailableError extends Error {
  constructor(message = 'Configuração da comissão da plataforma temporariamente indisponível no banco de dados.') {
    super(message);
    this.name = 'PlatformCommissionUnavailableError';
  }
}

export class PlatformCommissionService {
  public static readonly DEFAULT_FEE_CENTS = 50;
  public static readonly CACHE_TTL_MS = 60 * 1000; // 60 segundos de TTL normal
  public static readonly MAX_STALE_TTL_MS = 15 * 60 * 1000; // Tolerância máxima de 15 minutos em falha do Neon

  // Cache em memória da configuração administrativa (Single Source of Truth)
  private static cachedConfig: CommissionSettingsResponse | null = null;
  private static cacheExpiresAt: number = 0; // instante de expiração do TTL normal de 60s
  private static lastSuccessfulValidationAt: number = 0; // instante da última validação bem-sucedida no Neon

  /**
   * Helper para limpar o cache em memória durante testes unitários automatizados.
   */
  static _resetCacheForTesting(): void {
    this.cachedConfig = null;
    this.cacheExpiresAt = 0;
    this.lastSuccessfulValidationAt = 0;
  }

  /**
   * Helper para inspecionar metadados de cache em testes e diagnósticos.
   */
  static _getCacheMetadataForTesting(): {
    hasCachedConfig: boolean;
    cacheExpiresAt: number;
    lastSuccessfulValidationAt: number;
  } {
    return {
      hasCachedConfig: this.cachedConfig !== null,
      cacheExpiresAt: this.cacheExpiresAt,
      lastSuccessfulValidationAt: this.lastSuccessfulValidationAt,
    };
  }

  /**
   * Helper para configurar estado de cache e timestamps para testes unitários de tempo/expiração.
   */
  static _setCacheForTesting(
    config: CommissionSettingsResponse | null,
    cacheExpiresAt: number,
    lastSuccessfulValidationAt: number
  ): void {
    this.cachedConfig = config;
    this.cacheExpiresAt = cacheExpiresAt;
    this.lastSuccessfulValidationAt = lastSuccessfulValidationAt;
  }

  /**
   * Retrieves the current platform commission setting safely.
   * Uses an in-memory cache with 60-second normal TTL.
   * If Neon is temporarily unreachable but a valid configuration was previously loaded,
   * allows using the cached administrative configuration for at most 15 minutes from last successful validation.
   * If 15 minutes elapse without successful validation, invalidates cache and throws PlatformCommissionUnavailableError.
   * If Neon fails and no cached configuration exists, throws PlatformCommissionUnavailableError.
   * NEVER silently falls back to 50 cents when that could diverge from administrative configuration.
   */
  static async getCurrentCommission(): Promise<CommissionSettingsResponse> {
    const now = Date.now();

    // 1. Retorna cache fresco se ainda dentro do TTL normal de 60 segundos
    if (this.cachedConfig && now < this.cacheExpiresAt) {
      return this.cachedConfig;
    }

    try {
      await ensureCommissionSettings();

      if (!db?.query?.platformCommissionSettings?.findFirst) {
        throw new PlatformCommissionUnavailableError(
          'Tabela de configuração de comissão não inicializada ou indisponível.'
        );
      }

      const setting = await db.query.platformCommissionSettings.findFirst({
        orderBy: [desc(platformCommissionSettings.updatedAt)],
      });

      if (setting && typeof setting.feeCents === 'number' && !isNaN(setting.feeCents)) {
        const feeCents = Math.round(setting.feeCents);

        // Validação rigorosa dos limites administrativos
        if (!Number.isInteger(feeCents) || feeCents < 0 || feeCents > 100000) {
          throw new Error(`Valor de comissão inválido ou fora dos limites permitidos: ${setting.feeCents}`);
        }

        const feeReais = feeCents / 100;
        const config: CommissionSettingsResponse = {
          feeCents,
          feeReais,
          formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
          updatedAt: setting.updatedAt ? new Date(setting.updatedAt) : new Date(),
          updatedByName: setting.updatedByName || null,
          updatedByEmail: setting.updatedByEmail || null,
        };

        // Consulta bem-sucedida ao Neon:
        // Atualiza cache em memória com TTL de 60s e registra o instante da validação bem-sucedida
        this.cachedConfig = config;
        this.cacheExpiresAt = now + this.CACHE_TTL_MS;
        this.lastSuccessfulValidationAt = now;
        return config;
      }

      // Se a tabela existe mas ainda não possui linhas
      throw new PlatformCommissionUnavailableError(
        'Nenhum registro de configuração de comissão encontrado no banco de dados.'
      );
    } catch (err: any) {
      console.error('[PlatformCommissionService] Erro ao consultar comissão no Neon:', err?.message || err);

      // 2. Se houver falha no Neon e existir cache previamente confirmado:
      // Permitir o uso da última configuração confirmada por, no máximo, 15 minutos contados
      // a partir da ÚLTIMA consulta bem-sucedida ao banco.
      // IMPORTANTE: NÃO reiniciar a janela de 15 minutos quando o cache for lido ou utilizado!
      if (this.cachedConfig) {
        const elapsedSinceValidationMs = now - this.lastSuccessfulValidationAt;

        if (elapsedSinceValidationMs <= this.MAX_STALE_TTL_MS) {
          const elapsedSeconds = Math.round(elapsedSinceValidationMs / 1000);
          console.warn(
            `[PlatformCommissionService] Neon indisponível. Utilizando comissão confirmada pelo administrador (${this.cachedConfig.feeCents} centavos) validada há ${elapsedSeconds}s (dentro do limite máximo de 15 min).`
          );
          // Retorna a configuração em cache SEM alterar lastSuccessfulValidationAt nem cacheExpiresAt
          return this.cachedConfig;
        }

        // 3. Após 15 minutos sem conseguir revalidar a configuração, invalidar o cache
        const elapsedMinutes = Math.round(elapsedSinceValidationMs / 60000);
        console.error(
          `[PlatformCommissionService] Limite máximo de cache expirado (${elapsedMinutes} minutos desde a última validação no Neon). Invalidando cache para evitar operações com regras obsoletas.`
        );
        this.cachedConfig = null;
        this.cacheExpiresAt = 0;
        this.lastSuccessfulValidationAt = 0;
      }

      // 4. SEM FALLBACK SILENCIOSO: Se não houver configuração nem cache dentro da tolerância, lançar erro explícito
      if (err instanceof PlatformCommissionUnavailableError) {
        throw err;
      }
      throw new PlatformCommissionUnavailableError(
        `Configuração da comissão da plataforma indisponível: ${err?.message || 'Falha de conexão com o banco'}`
      );
    }
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
    const updatedResponse: CommissionSettingsResponse = {
      feeCents: newFeeCents,
      feeReais,
      formattedFee: `R$ ${feeReais.toFixed(2).replace('.', ',')}`,
      updatedAt: now,
      updatedByName: adminUser.name || 'Administrador',
      updatedByEmail: adminUser.email || null,
    };

    // Atualiza imediatamente o cache em memória com a nova configuração do administrador
    // e atualiza os metadados de validade (TTL normal e última validação com o banco)
    const currentTimestamp = Date.now();
    this.cachedConfig = updatedResponse;
    this.cacheExpiresAt = currentTimestamp + this.CACHE_TTL_MS;
    this.lastSuccessfulValidationAt = currentTimestamp;

    return updatedResponse;
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
