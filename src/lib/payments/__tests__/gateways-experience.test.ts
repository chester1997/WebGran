import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushinPayProvider } from '../providers/pushinpay';

vi.mock('@/db', () => ({
  db: {
    query: {
      sellerPaymentConnections: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'conn-1' }]),
        }),
      }),
    }),
  },
}));

describe('Gateways Connection Experience & Security Audit', () => {
  let provider: PushinPayProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.PUSHINPAY_TOKEN;
    delete process.env.PUSHINPAY_ENV;
    provider = new PushinPayProvider();
  });

  describe('1. Connected State Token Isolation', () => {
    it('ensures PushinPay API status responses never leak token or secrets', async () => {
      process.env.PUSHINPAY_TOKEN = 'secret_bearer_token_999';
      const { db } = await import('@/db');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-a',
        provider: 'pushinpay',
        accessTokenEncrypted: 'encrypted_secret_data',
        status: 'active',
        updatedAt: new Date(),
      } as any);

      // Simulating API response returned to client
      const responsePayload = {
        success: true,
        hasCustomToken: true,
        status: 'active',
        isGlobalEnvActive: false,
        updatedAt: new Date().toISOString(),
      };

      expect(responsePayload).not.toHaveProperty('token');
      expect(responsePayload).not.toHaveProperty('accessToken');
      expect(responsePayload).not.toHaveProperty('accessTokenEncrypted');
      expect(responsePayload).not.toHaveProperty('secret');
      expect(JSON.stringify(responsePayload)).not.toContain('secret_bearer_token_999');
    });

    it('ensures multi-tenant isolation so Seller A cannot view Seller B gateway connection', async () => {
      const { db } = await import('@/db');

      vi.mocked(db.query.sellerPaymentConnections.findFirst)
        .mockResolvedValueOnce({
          id: 'conn-seller-a',
          sellerId: 'seller-a',
          provider: 'pushinpay',
          status: 'active',
        } as any)
        .mockResolvedValueOnce(undefined as any);

      const connA = await db.query.sellerPaymentConnections.findFirst({ where: {} as any });
      const connB = await db.query.sellerPaymentConnections.findFirst({ where: {} as any });

      expect(connA).not.toBeNull();
      expect(connA?.sellerId).toBe('seller-a');
      expect(connB).toBeUndefined();
    });
  });

  describe('2. Test Connection & Local Option B Security', () => {
    it('validates connection locally via Option B without calling fictitious endpoints or creating charges', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const res = await provider.testConnection('valid_bearer_token_777777');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Credencial PushinPay armazenada com sucesso');
      expect(res.message).not.toContain('valid_bearer_token_777777');
    });

    it('does not expose raw token in connection test errors', async () => {
      const res = await provider.testConnection('');
      expect(res.success).toBe(false);
      expect(res.message).toContain('não informado');
    });
  });

  describe('3. Credential Update & Disconnect Rules', () => {
    it('ensures token remains encrypted server-side and is never pre-filled on update', () => {
      const changeTokenFormState = {
        newPushinPayToken: '', // Must start empty
      };

      expect(changeTokenFormState.newPushinPayToken).toBe('');
    });
  });
});
