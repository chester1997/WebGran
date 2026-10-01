import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth dependencies
vi.mock('@/lib/auth', () => ({
  requirePlatformAdmin: vi.fn(async () => ({
    id: 'super-admin-999',
    email: 'superadmin@webgran.online',
    role: 'super_admin',
  })),
  requireAdmin: vi.fn(async () => ({
    id: 'admin-888',
    email: 'admin@webgran.online',
    role: 'admin',
  })),
  requireSeller: vi.fn(async () => ({
    id: 'seller-123',
    email: 'seller@webgran.online',
    role: 'seller',
  })),
}));

// Mock DB module for testing Admin API routes
vi.mock('@/db', () => {
  const mockPlan = {
    id: 'plan-webgran-id',
    name: 'WebGran',
    slug: 'webgran',
    description: 'Plano Único WebGran SaaS',
    price: '89.90',
    billingInterval: 'month',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFeature = {
    id: 'feat-1-id',
    key: 'max_products',
    name: 'Limite de Produtos',
    description: 'Produtos no catálogo',
    type: 'LIMIT',
    category: 'catalog',
    defaultValue: { value: -1 },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    db: {
      query: {
        subscriptionPlans: {
          findMany: vi.fn(async () => [mockPlan]),
          findFirst: vi.fn(async () => null),
        },
        features: {
          findMany: vi.fn(async () => [mockFeature]),
          findFirst: vi.fn(async () => mockFeature),
        },
        planFeatures: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => null),
        },
        subscriptions: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => ({ id: 'sub-1', planId: 'plan-webgran-id' })),
        },
        sellerFeatureOverrides: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => null),
        },
        users: {
          findFirst: vi.fn(async () => ({ id: 'seller-123', role: 'seller', name: 'Vendedor Teste' })),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ count: 0 }])),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => [{
            id: 'new-id',
            name: 'Plano Pro',
            slug: 'plano-pro',
            price: '149.90',
            billingInterval: 'month',
            active: true,
          }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => [{
              id: 'plan-webgran-id',
              name: 'WebGran Editado',
              slug: 'webgran',
              price: '99.90',
              billingInterval: 'month',
              active: true,
            }]),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
      execute: vi.fn(() => Promise.resolve()),
    },
  };
});

vi.mock('@/db/ensure-entitlements', () => ({
  ensureEntitlementTablesAndSeed: vi.fn(() => Promise.resolve()),
}));

import { db } from '@/db';

describe('Admin Plans & Features Phase 3 Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Plans Admin API', () => {
    it('allows platform admin to list plans', async () => {
      const { GET } = await import('../route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plans).toBeDefined();
      expect(data.plans.length).toBeGreaterThan(0);
      expect(data.plans[0].slug).toBe('webgran');
    }, 15000);

    it('allows platform admin to create a new plan', async () => {
      (db.query.subscriptionPlans.findFirst as any).mockResolvedValueOnce(null);

      const { POST } = await import('../route');
      const req = new Request('http://localhost/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Plano Pro',
          slug: 'plano-pro',
          price: '149.90',
          description: 'Plano avançado',
          billingInterval: 'month',
          active: true,
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.plan.name).toBe('Plano Pro');
    });

    it('blocks plan deletion if active subscriptions exist', async () => {
      (db.query.subscriptionPlans.findFirst as any).mockResolvedValueOnce({
        id: 'plan-webgran-id',
        name: 'WebGran',
      });

      // Mock subscriptions query returning count > 0
      (db.select as any).mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([{ count: 5 }]),
        }),
      }));

      const { DELETE } = await import('../[id]/route');
      const req = new Request('http://localhost/api/admin/plans/plan-webgran-id', {
        method: 'DELETE',
      });

      const response = await DELETE(req, { params: Promise.resolve({ id: 'plan-webgran-id' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('vendedores vinculados');
    });
  });

  describe('2. Features & Entitlements Admin API', () => {
    it('allows admin to list features catalog', async () => {
      const { GET } = await import('../../features/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.features).toBeDefined();
      expect(data.features[0].key).toBe('max_products');
    });

    it('allows admin to create a new feature in catalog', async () => {
      (db.query.features.findFirst as any).mockResolvedValueOnce(null);

      const { POST } = await import('../../features/route');
      const req = new Request('http://localhost/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'custom_feature_test',
          name: 'Feature de Teste',
          description: 'Descrição de teste',
          type: 'BOOLEAN',
          category: 'marketing',
          defaultValue: true,
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('supports bulk plan features configuration (BOOLEAN, LIMIT, QUOTA)', async () => {
      (db.query.subscriptionPlans.findFirst as any).mockResolvedValueOnce({ id: 'plan-webgran-id' });

      const { PUT } = await import('../[id]/features/route');
      const req = new Request('http://localhost/api/admin/plans/plan-webgran-id/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureValues: [
            { featureId: 'feat-1-id', value: 1000 },
            { featureId: 'feat-2-id', value: true },
            { featureId: 'feat-3-id', value: 50 },
          ],
        }),
      });

      const response = await PUT(req, { params: Promise.resolve({ id: 'plan-webgran-id' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('allows admin to create seller override and change seller plan', async () => {
      (db.query.subscriptionPlans.findFirst as any).mockResolvedValueOnce({ id: 'plan-webgran-id', name: 'WebGran' });

      const { POST, PATCH } = await import('../../sellers/[id]/entitlements/route');
      
      // Test Create Override
      const postReq = new Request('http://localhost/api/admin/sellers/seller-123/entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureKey: 'max_products',
          overrideValue: 500,
          reason: 'Bônus de Suporte',
        }),
      });

      const postRes = await POST(postReq, { params: Promise.resolve({ id: 'seller-123' }) });
      const postData = await postRes.json();

      expect(postRes.status).toBe(200);
      expect(postData.success).toBe(true);

      // Test Change Seller Plan
      const patchReq = new Request('http://localhost/api/admin/sellers/seller-123/entitlements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: 'plan-webgran-id',
        }),
      });

      const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: 'seller-123' }) });
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.success).toBe(true);
    });
  });

  describe('3. Authorization Protection', () => {
    it('blocks non-admin users from admin plan endpoints', async () => {
      const { requirePlatformAdmin } = await import('@/lib/auth');
      (requirePlatformAdmin as any).mockRejectedValueOnce(new Error('FORBIDDEN'));

      const { GET } = await import('../route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Acesso negado');
    });
  });
});
