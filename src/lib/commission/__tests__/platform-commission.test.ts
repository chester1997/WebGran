import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformCommissionService, PlatformCommissionUnavailableError } from '../platform-commission-service';
import { db } from '@/db';
import { platformCommissionSettings, platformCommissionAuditLogs, orders } from '@/db/schema';
import { pushinPayProvider } from '@/lib/payments/providers/pushinpay';
import { getSellerSubscription } from '@/lib/billing/subscription-service';
import { getSellerEntitlement } from '@/lib/entitlements/entitlement-service';
import { GET as adminCommissionGET } from '@/app/api/admin/commission/route';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
      features: {
        findFirst: vi.fn(),
      },
      sellerFeatureOverrides: {
        findFirst: vi.fn(),
      },
      planFeatures: {
        findFirst: vi.fn(),
      },
      subscriptions: {
        findFirst: vi.fn(),
      },
      subscriptionPlans: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      videoLibrarySubscriptions: {
        findFirst: vi.fn(),
      },
      platformCommissionSettings: {
        findFirst: vi.fn(),
      },
      platformCommissionAuditLogs: {
        findMany: vi.fn(),
      },
      sellerPaymentConnections: {
        findFirst: vi.fn(),
      },
      paymentWebhookEvents: {
        findFirst: vi.fn(),
      },
      invoices: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
        onConflictDoNothing: vi.fn().mockResolvedValue({}),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-order-id' }]),
        })),
      })),
    })),
    execute: vi.fn().mockResolvedValue({}),
    transaction: vi.fn(async (cb: any) => cb(db)),
  },
}));

vi.mock('@/db/ensure-commission-settings', () => ({
  ensureCommissionSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db/ensure-payment-tables', () => ({
  ensurePaymentTables: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((txt: string) => `enc_${txt}`),
  decrypt: vi.fn((txt: string) => txt.replace(/^enc_/, '')),
}));

vi.mock('@/lib/delivery/access-delivery-service', () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    id: 'admin-id-1',
    name: 'Admin Teste',
    email: 'admin@webgran.com',
    role: 'admin',
  }),
}));

describe('WebGran Platform Commission & Commercial Model Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    PlatformCommissionService._resetCacheForTesting();
    process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID = 'plat-account-uuid-123';
    process.env.PUSHINPAY_PLATFORM_STORE_ID = 'store-official-webgran';
  });

  // 1. Banco disponível com comissão configurada em 50 centavos
  describe('1. Banco disponível com comissão configurada em 50 centavos', () => {
    it('retorna R$ 0,50 (50 centavos) quando configurado no banco', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-50',
        feeCents: 50,
        updatedAt: new Date('2026-10-22T10:00:00Z'),
        updatedByName: 'SISTEMA',
      });

      const comm = await PlatformCommissionService.getCurrentCommission();
      expect(comm.feeCents).toBe(50);
      expect(comm.feeReais).toBe(0.50);
      expect(comm.formattedFee).toBe('R$ 0,50');
    });
  });

  // 2. Banco disponível com comissão configurada em R$ 1,00
  describe('2. Banco disponível com comissão configurada em R$ 1,00', () => {
    it('retorna R$ 1,00 (100 centavos) quando configurado no banco', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-100',
        feeCents: 100,
        updatedAt: new Date('2026-10-22T11:00:00Z'),
        updatedByName: 'Admin Luiz',
        updatedByEmail: 'luiz@webgran.com',
      });

      const comm = await PlatformCommissionService.getCurrentCommission();
      expect(comm.feeCents).toBe(100);
      expect(comm.feeReais).toBe(1.00);
      expect(comm.formattedFee).toBe('R$ 1,00');
      expect(comm.updatedByName).toBe('Admin Luiz');
    });
  });

  // 3. Cache válido por até 60 segundos
  describe('3. Cache válido por até 60 segundos', () => {
    it('retorna configuração em cache dentro do TTL de 60 segundos sem consultar o Neon novamente', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-75',
        feeCents: 75,
        updatedAt: new Date(),
        updatedByName: 'Admin',
      });

      const first = await PlatformCommissionService.getCurrentCommission();
      expect(first.feeCents).toBe(75);
      expect(db.query.platformCommissionSettings.findFirst).toHaveBeenCalledTimes(1);

      // Segunda chamada imediata (dentro dos 60 segundos)
      const second = await PlatformCommissionService.getCurrentCommission();
      expect(second.feeCents).toBe(75);
      // DB não deve ser consultado novamente
      expect(db.query.platformCommissionSettings.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  // 4. Falha do Neon com cache ainda dentro da janela de tolerância de 15 minutos
  describe('4. Falha do Neon com cache dentro da janela de tolerância de 15 minutos', () => {
    it('permite uso da configuração em cache durante falha do Neon se dentro do limite de 15 minutos', async () => {
      vi.useFakeTimers();
      const startTime = new Date('2026-10-22T12:00:00Z');
      vi.setSystemTime(startTime);

      // 1ª chamada bem-sucedida: grava R$ 1,50 no Neon e no cache
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValueOnce({
        id: 'setting-150',
        feeCents: 150,
        updatedAt: startTime,
        updatedByName: 'Admin',
      });

      const firstCall = await PlatformCommissionService.getCurrentCommission();
      expect(firstCall.feeCents).toBe(150);

      // Avança o tempo em 5 minutos (300 segundos > TTL normal de 60s, mas < 15 min de tolerância máxima)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Neon falha
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValueOnce(
        new Error('Neon Connection Timeout (ETIMEDOUT)')
      );

      const fallbackCall = await PlatformCommissionService.getCurrentCommission();
      expect(fallbackCall.feeCents).toBe(150);
      expect(fallbackCall.formattedFee).toBe('R$ 1,50');

      vi.useRealTimers();
    });

    it('não reinicia a janela de 15 minutos quando o cache é lido sob falha', async () => {
      vi.useFakeTimers();
      const startTime = new Date('2026-10-22T12:00:00Z');
      vi.setSystemTime(startTime);

      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValueOnce({
        id: 'setting-150',
        feeCents: 150,
        updatedAt: startTime,
        updatedByName: 'Admin',
      });
      await PlatformCommissionService.getCurrentCommission();

      const meta1 = PlatformCommissionService._getCacheMetadataForTesting();
      expect(meta1.lastSuccessfulValidationAt).toBe(startTime.getTime());

      // Avança 10 minutos e lê sob falha do Neon
      vi.advanceTimersByTime(10 * 60 * 1000);
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValue(
        new Error('Neon Outage')
      );

      await PlatformCommissionService.getCurrentCommission();
      const meta2 = PlatformCommissionService._getCacheMetadataForTesting();
      // O instante da última validação bem-sucedida NÃO pode ser alterado na leitura sob erro!
      expect(meta2.lastSuccessfulValidationAt).toBe(startTime.getTime());

      vi.useRealTimers();
    });
  });

  // 5. Falha contínua do Neon após o limite de 15 minutos
  describe('5. Falha contínua do Neon após o limite de 15 minutos', () => {
    it('invalida o cache e lança PlatformCommissionUnavailableError após 15 minutos contínuos de falha', async () => {
      vi.useFakeTimers();
      const startTime = new Date('2026-10-22T12:00:00Z');
      vi.setSystemTime(startTime);

      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValueOnce({
        id: 'setting-250',
        feeCents: 250,
        updatedAt: startTime,
        updatedByName: 'Admin',
      });
      await PlatformCommissionService.getCurrentCommission();

      // Avança além do limite máximo de 15 minutos (15 minutos e 1 segundo)
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      // Neon continua inacessível
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValue(
        new Error('Neon Prolonged Outage')
      );

      // Deve invalidar o cache e lançar erro explícito!
      await expect(PlatformCommissionService.getCurrentCommission()).rejects.toThrow(
        PlatformCommissionUnavailableError
      );

      // Verifica se o cache foi realmente invalidado
      const meta = PlatformCommissionService._getCacheMetadataForTesting();
      expect(meta.hasCachedConfig).toBe(false);

      vi.useRealTimers();
    });
  });

  // 6. Ausência de cache confirmado
  describe('6. Ausência de cache confirmado', () => {
    it('lança PlatformCommissionUnavailableError imediatamente quando não há cache confirmado', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValue(
        new Error('Neon Database Unreachable')
      );

      await expect(PlatformCommissionService.getCurrentCommission()).rejects.toThrow(
        PlatformCommissionUnavailableError
      );
    });

    it('interrompe criação de Pix na Pushin Pay e não cria cobrança quando o Neon falha sem cache', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValue(
        new Error('Neon Database Outage')
      );

      (db.query.orders.findFirst as any).mockResolvedValue({
        id: 'order-no-cache',
        status: 'pending',
        total: '10.00',
        storeId: 'store-1',
      });

      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: 'enc_valid_pushin_token',
        status: 'active',
      });

      // global fetch não deve ser chamado para o endpoint de Pix da Pushin Pay
      global.fetch = vi.fn();

      await expect(
        pushinPayProvider.createPixPayment({
          orderId: 'order-no-cache',
          sellerId: 'seller-1',
          amount: 10.00,
          customer: { name: 'Cliente' },
        })
      ).rejects.toThrow('Parâmetros de cobrança temporariamente indisponíveis. Tente novamente em instantes.');

      // Garante que nenhuma requisição de cashIn foi disparada
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // 7. Recuperação do Neon após uma falha
  describe('7. Recuperação do Neon após uma falha', () => {
    it('atualiza o cache e reinicia os metadados de validade quando o Neon se recupera', async () => {
      vi.useFakeTimers();
      const t0 = new Date('2026-10-22T08:00:00Z');
      vi.setSystemTime(t0);

      // Inicial: 100 centavos
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValueOnce({
        id: 'setting-100',
        feeCents: 100,
        updatedAt: t0,
        updatedByName: 'Admin',
      });
      await PlatformCommissionService.getCurrentCommission();

      // Falha do Neon aos 10 minutos (dentro dos 15 minutos)
      vi.advanceTimersByTime(10 * 60 * 1000);
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValueOnce(
        new Error('Neon Blip')
      );
      const staleRes = await PlatformCommissionService.getCurrentCommission();
      expect(staleRes.feeCents).toBe(100);

      // Neon se recupera aos 12 minutos com taxa atualizada pelo banco para 120 centavos
      vi.advanceTimersByTime(2 * 60 * 1000);
      const recoveryTime = new Date(t0.getTime() + 12 * 60 * 1000);
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValueOnce({
        id: 'setting-120',
        feeCents: 120,
        updatedAt: recoveryTime,
        updatedByName: 'Admin',
      });

      const recoveredRes = await PlatformCommissionService.getCurrentCommission();
      expect(recoveredRes.feeCents).toBe(120);

      const meta = PlatformCommissionService._getCacheMetadataForTesting();
      expect(meta.lastSuccessfulValidationAt).toBe(recoveryTime.getTime());
      expect(meta.cacheExpiresAt).toBe(recoveryTime.getTime() + 60 * 1000);

      vi.useRealTimers();
    });
  });

  // 8. Atualização da comissão após alteração administrativa
  describe('8. Atualização da comissão após alteração administrativa', () => {
    it('atualiza o cache e a data da última validação imediatamente após updateCommission', async () => {
      vi.useFakeTimers();
      const updateTime = new Date('2026-10-22T14:30:00Z');
      vi.setSystemTime(updateTime);

      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-existing',
        feeCents: 50,
      });

      const updated = await PlatformCommissionService.updateCommission(
        200,
        { id: 'admin-uuid', name: 'Admin Luiz', email: 'luiz@webgran.com' },
        'Ajuste comercial'
      );

      expect(updated.feeCents).toBe(200);

      const meta = PlatformCommissionService._getCacheMetadataForTesting();
      expect(meta.hasCachedConfig).toBe(true);
      expect(meta.lastSuccessfulValidationAt).toBe(updateTime.getTime());
      expect(meta.cacheExpiresAt).toBe(updateTime.getTime() + 60 * 1000);

      // Próxima chamada síncrona utiliza o novo valor sem bater no DB
      vi.clearAllMocks();
      const freshRes = await PlatformCommissionService.getCurrentCommission();
      expect(freshRes.feeCents).toBe(200);

      vi.useRealTimers();
    });
  });

  // 9. Garantia de que nenhuma falha retorna silenciosamente a taxa padrão de R$ 0,50
  describe('9. Ausência de fallback silencioso', () => {
    it('NUNCA retorna 50 centavos silenciosamente se o Neon falhar e a taxa configurada era R$ 2,00', async () => {
      // Carrega R$ 2,00 no cache
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValueOnce({
        id: 'setting-200',
        feeCents: 200,
        updatedAt: new Date(),
        updatedByName: 'Admin',
      });
      await PlatformCommissionService.getCurrentCommission();

      // Força erro de banco
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValue(
        new Error('Database Read Error')
      );

      const res = await PlatformCommissionService.getCurrentCommission();
      // Não pode ser 50 centavos!
      expect(res.feeCents).toBe(200);
      expect(res.feeCents).not.toBe(50);
      expect(res.feeCents).not.toBe(PlatformCommissionService.DEFAULT_FEE_CENTS);
    });

    it('NUNCA retorna 50 centavos silenciosamente quando não há cache e o banco falha', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValue(
        new Error('Database Read Error')
      );

      await expect(PlatformCommissionService.getCurrentCommission()).rejects.toThrow(
        PlatformCommissionUnavailableError
      );
    });
  });

  // 6. API administrativa indisponível: retornar HTTP 503
  describe('6. API administrativa indisponível retorna HTTP 503', () => {
    it('GET /api/admin/commission retorna status 503 quando o banco está inacessível sem cache', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockRejectedValue(
        new Error('Neon Service Unavailable')
      );

      const response = await adminCommissionGET();
      expect(response.status).toBe(503);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('indisponível');
    });
  });

  // 7. Valor inválido ou fora dos limites: rejeitar a configuração
  describe('7. Validação de valores inválidos ou fora dos limites', () => {
    it('rejeita comissão com valor negativo, não inteiro ou superior a R$ 1.000,00', async () => {
      await expect(
        PlatformCommissionService.updateCommission(-10, { id: 'admin-1' })
      ).rejects.toThrow('O valor da comissão não pode ser negativo.');

      await expect(
        PlatformCommissionService.updateCommission(50.5 as any, { id: 'admin-1' })
      ).rejects.toThrow('O valor da comissão deve ser um número inteiro de centavos válido.');

      await expect(
        PlatformCommissionService.updateCommission(NaN, { id: 'admin-1' })
      ).rejects.toThrow('O valor da comissão deve ser um número inteiro de centavos válido.');

      await expect(
        PlatformCommissionService.updateCommission(150000, { id: 'admin-1' })
      ).rejects.toThrow('O valor da comissão não pode exceder R$ 1.000,00 por venda.');
    });

    it('rejeita valor inválido retornado pelo banco de dados', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-corrupt',
        feeCents: -50, // negativo no banco
      });

      await expect(PlatformCommissionService.getCurrentCommission()).rejects.toThrow(
        PlatformCommissionUnavailableError
      );
    });
  });

  // 8. Integração Pushin Pay, Preservação Histórica e Isolamento da Biblioteca de Vídeos
  describe('8. Split Dinâmico, Histórico e Isolamento', () => {
    it('aplica a comissão dinâmica configurada (R$ 0,80) na criação do Pix na Pushin Pay', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-80',
        feeCents: 80,
      });

      (db.query.orders.findFirst as any).mockResolvedValue({
        id: 'order-dyn-80',
        status: 'pending',
        total: '10.00',
        storeId: 'store-1',
      });

      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: 'enc_valid_pushin_token',
        status: 'active',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pushin_tx_80',
          qr_code: 'pix_code_80',
          split_rules: [{ value: 80, account_id: 'plat-account-uuid-123' }],
        }),
      } as any);

      await pushinPayProvider.createPixPayment({
        orderId: 'order-dyn-80',
        sellerId: 'seller-1',
        amount: 10.00,
        customer: { name: 'Cliente' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/pix/cashIn'),
        expect.objectContaining({
          body: expect.stringContaining('"value":80'),
        })
      );
      expect(db.update).toHaveBeenCalledWith(orders);
    });

    it('pula o split (SKIPPED) quando o total da venda é menor ou igual à taxa da comissão', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-100',
        feeCents: 100,
      });

      (db.query.orders.findFirst as any).mockResolvedValue({
        id: 'order-small',
        status: 'pending',
        total: '0.80', // 80 cents <= 100 cents
        storeId: 'store-1',
      });

      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: 'enc_valid_pushin_token',
        status: 'active',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pushin_tx_small',
          qr_code: 'pix_code_small',
        }),
      } as any);

      await pushinPayProvider.createPixPayment({
        orderId: 'order-small',
        sellerId: 'seller-1',
        amount: 0.80,
        customer: { name: 'Cliente' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/pix/cashIn'),
        expect.objectContaining({
          body: expect.not.stringContaining('"split_rules"'),
        })
      );
    });

    it('preserva a taxa histórica de pedidos antigos criados com 50 centavos mesmo que a taxa atual seja maior', async () => {
      (db.query.platformCommissionSettings.findFirst as any).mockResolvedValue({
        id: 'setting-current',
        feeCents: 200, // taxa atual é R$ 2,00
      });

      (db.query.orders.findFirst as any).mockResolvedValue({
        id: 'order-past-50',
        paymentId: 'tx-past-50',
        paymentMethod: 'pushinpay',
        status: 'pending',
        total: '20.00',
        storeId: 'store-1',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50, // PRESERVADO HISTORICAMENTE
      });

      (db.query.stores.findFirst as any).mockResolvedValue({
        id: 'store-1',
        ownerId: 'seller-1',
      });

      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        accessTokenEncrypted: 'enc_valid_pushin_token',
        status: 'active',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'tx-past-50',
          status: 'paid',
          value: 2000,
          split_rules: [{ value: 50, account_id: 'plat-account-uuid-123' }],
        }),
      } as any);

      const webhookRes = await pushinPayProvider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-past-50', status: 'paid', value: 2000 }),
        {}
      );

      expect(webhookRes.success).toBe(true);
      expect(db.update).toHaveBeenCalledWith(orders);
    });

    it('video_storage_quota_gb continua exigindo obrigatoriamente assinatura ativa na Biblioteca de Vídeos', async () => {
      (db.query.users.findFirst as any).mockResolvedValue({
        id: 'seller-normal',
        role: 'seller',
      });

      (db.query.features.findFirst as any).mockResolvedValue({
        id: 'feat-storage',
        key: 'video_storage_quota_gb',
        type: 'LIMIT',
        isActive: true,
        defaultValue: '0',
      });

      (db.query.sellerFeatureOverrides.findFirst as any).mockResolvedValue(null);
      (db.query.videoLibrarySubscriptions.findFirst as any).mockResolvedValue(null);

      const entitlement = await getSellerEntitlement('seller-normal', 'video_storage_quota_gb');
      expect(entitlement.value).toBe(0);
      expect(entitlement.source).toBe('INACTIVE');
    });

    it('lojista geral tem isSubscriptionActive: true sem expiração regressiva de mensalidade', async () => {
      (db.query.users.findFirst as any).mockResolvedValue({
        id: 'seller-normal',
        role: 'seller',
      });

      (db.query.subscriptionPlans.findFirst as any).mockResolvedValue({
        id: 'plan-default',
        name: 'WebGran',
        slug: 'webgran',
        price: '97.00',
        active: true,
      });

      (db.query.subscriptions.findFirst as any).mockResolvedValue({
        id: 'sub-seller-1',
        sellerId: 'seller-normal',
        status: 'TRIAL',
        currentPeriodEnd: new Date(Date.now() - 1000 * 60 * 60 * 24),
        invoices: [],
      });

      const subData = await getSellerSubscription('seller-normal');
      expect(subData.isSubscriptionActive).toBe(true);
      expect(subData.isTrialActive).toBe(false);
      expect(subData.trialDaysRemaining).toBe(0);
    });
  });
});
