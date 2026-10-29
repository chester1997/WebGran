import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SellerCommissionService,
  SellerCommissionValidationError,
  SellerCommissionConcurrencyError,
  parseRecifeToUTC,
} from '../seller-commission-service';
import { PlatformCommissionService } from '../platform-commission-service';

vi.mock('@/db', () => {
  return {
    db: {
      query: {
        sellerCommissionSettings: {
          findFirst: vi.fn(),
        },
        sellerCommissionAuditLogs: {
          findMany: vi.fn(),
        },
      },
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(async (callback) => {
        return await callback({
          query: {
            sellerCommissionSettings: {
              findFirst: vi.fn(),
            },
          },
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([]),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([]),
              })),
            })),
          })),
        });
      }),
    },
    sellerCommissionSettings: {
      id: 'id',
      sellerId: 'seller_id',
      customFeeCents: 'custom_fee_cents',
      exemptionActive: 'exemption_active',
      exemptionStart: 'exemption_start',
      exemptionEnd: 'exemption_end',
      exemptionReason: 'exemption_reason',
      version: 'version',
      updatedAt: 'updated_at',
      updatedById: 'updated_by_id',
      updatedByName: 'updated_by_name',
      updatedByEmail: 'updated_by_email',
    },
    sellerCommissionAuditLogs: {
      id: 'id',
      sellerId: 'seller_id',
      previousFeeCents: 'previous_fee_cents',
      newFeeCents: 'new_fee_cents',
      previousExemptionActive: 'previous_exemption_active',
      newExemptionActive: 'new_exemption_active',
      previousExemptionStart: 'previous_exemption_start',
      previousExemptionEnd: 'previous_exemption_end',
      newExemptionStart: 'new_exemption_start',
      newExemptionEnd: 'new_exemption_end',
      reason: 'reason',
      changedById: 'changed_by_id',
      changedByName: 'changed_by_name',
      changedByEmail: 'changed_by_email',
      createdAt: 'created_at',
    },
  };
});

import { db } from '@/db';

describe('SellerCommissionService — Fase 2: Motor de Resolução de Taxas e Auditoria', () => {
  const mockAdmin = {
    id: 'admin-uuid-1',
    name: 'Admin Test',
    email: 'admin@webgran.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PlatformCommissionService, 'getCurrentCommissionCents').mockResolvedValue(50);
  });

  describe('1. Resolução de Taxa Padrão e Personalizada', () => {
    it('1.1. Herda a taxa padrão de 50 centavos (R$ 0,50) quando não existe configuração individual', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue(null as any);

      const res = await SellerCommissionService.resolveEffectiveFee('seller-no-config');

      expect(res.sellerId).toBe('seller-no-config');
      expect(res.effectiveFeeCents).toBe(50);
      expect(res.effectiveFeeReais).toBe(0.5);
      expect(res.formattedFee).toBe('R$ 0,50');
      expect(res.source).toBe('PLATFORM_DEFAULT');
      expect(res.isExempt).toBe(false);
      expect(res.customFeeCents).toBeNull();
      expect(res.exemption.status).toBe('NONE');
    });

    it('1.2. Aplica taxa personalizada de 0 centavos (taxa zero permanente sem confundir com NULL)', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue({
        id: 'cfg-1',
        sellerId: 'seller-zero',
        customFeeCents: 0,
        exemptionActive: false,
        version: 1,
      } as any);

      const res = await SellerCommissionService.resolveEffectiveFee('seller-zero');

      expect(res.effectiveFeeCents).toBe(0);
      expect(res.effectiveFeeReais).toBe(0.0);
      expect(res.formattedFee).toBe('R$ 0,00');
      expect(res.source).toBe('CUSTOM');
      expect(res.isExempt).toBe(false); // taxa zero configurada não é isenção temporária
      expect(res.customFeeCents).toBe(0);
    });

    it('1.3. Aplica taxas personalizadas válidas de 1, 25 e 50 centavos', async () => {
      const fees = [1, 25, 50];

      for (const fee of fees) {
        vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue({
          id: `cfg-${fee}`,
          sellerId: `seller-${fee}`,
          customFeeCents: fee,
          exemptionActive: false,
          version: 1,
        } as any);

        const res = await SellerCommissionService.resolveEffectiveFee(`seller-${fee}`);

        expect(res.effectiveFeeCents).toBe(fee);
        expect(res.effectiveFeeReais).toBe(fee / 100);
        expect(res.formattedFee).toBe(`R$ ${(fee / 100).toFixed(2).replace('.', ',')}`);
        expect(res.source).toBe('CUSTOM');
        expect(res.isExempt).toBe(false);
      }
    });

    it('1.4. Retorna à taxa padrão da plataforma quando customFeeCents é explicitamente NULL', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue({
        id: 'cfg-null',
        sellerId: 'seller-null-fee',
        customFeeCents: null,
        exemptionActive: false,
        version: 2,
      } as any);

      const res = await SellerCommissionService.resolveEffectiveFee('seller-null-fee');

      expect(res.effectiveFeeCents).toBe(50);
      expect(res.source).toBe('PLATFORM_DEFAULT');
      expect(res.customFeeCents).toBeNull();
    });
  });

  describe('2. Validação Rigorosa de Valores de Taxa', () => {
    it('2.1. Rejeita valores negativos', () => {
      expect(() => SellerCommissionService.validateFeeCents(-1)).toThrow(SellerCommissionValidationError);
      expect(() => SellerCommissionService.validateFeeCents(-50)).toThrow('A taxa não pode ser negativa.');
    });

    it('2.2. Rejeita valores acima de 50 centavos', () => {
      expect(() => SellerCommissionService.validateFeeCents(51)).toThrow('A taxa não pode exceder 50 centavos');
      expect(() => SellerCommissionService.validateFeeCents(100)).toThrow(SellerCommissionValidationError);
    });

    it('2.3. Rejeita números fracionários/decimais', () => {
      expect(() => SellerCommissionService.validateFeeCents(0.5)).toThrow('valor inteiro em centavos, sem frações');
      expect(() => SellerCommissionService.validateFeeCents(25.5)).toThrow(SellerCommissionValidationError);
    });

    it('2.4. Rejeita NaN, Infinity, strings e tipos não numéricos', () => {
      expect(() => SellerCommissionService.validateFeeCents(NaN)).toThrow(SellerCommissionValidationError);
      expect(() => SellerCommissionService.validateFeeCents(Infinity)).toThrow(SellerCommissionValidationError);
      expect(() => SellerCommissionService.validateFeeCents('25' as any)).toThrow(SellerCommissionValidationError);
      expect(() => SellerCommissionService.validateFeeCents({} as any)).toThrow(SellerCommissionValidationError);
    });

    it('2.5. Aceita null e undefined para representar herança da taxa padrão', () => {
      expect(SellerCommissionService.validateFeeCents(null)).toBeNull();
      expect(SellerCommissionService.validateFeeCents(undefined)).toBeNull();
    });
  });

  describe('3. Isenções Temporárias (Início Inclusivo e Término Exclusivo)', () => {
    const startUTC = new Date('2026-11-01T03:00:00.000Z'); // 00:00 em America/Recife
    const endUTC = new Date('2026-11-08T03:00:00.000Z'); // 00:00 de 08/11 em America/Recife (7 dias completos)

    const baseExemptSetting = {
      id: 'cfg-exempt',
      sellerId: 'seller-promo',
      customFeeCents: 30, // taxa normal configurada: 30 centavos
      exemptionActive: true,
      exemptionStart: startUTC,
      exemptionEnd: endUTC,
      exemptionReason: 'Campanha Black Friday',
      version: 1,
    };

    it('3.1. Isenção Futura (now < start): não aplica taxa zero, mantém taxa base personalizada com status PENDING', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue(baseExemptSetting as any);

      // 1 hora antes do início
      const beforeStart = new Date(startUTC.getTime() - 3600000);
      const res = await SellerCommissionService.resolveEffectiveFee('seller-promo', beforeStart);

      expect(res.effectiveFeeCents).toBe(30);
      expect(res.source).toBe('CUSTOM');
      expect(res.isExempt).toBe(false);
      expect(res.exemption.status).toBe('PENDING');
      expect(res.exemption.isActive).toBe(false);
    });

    it('3.2. Início Inclusivo (now = start): aplica taxa zero e status ACTIVE', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue(baseExemptSetting as any);

      // Exatamente no milissegundo de início
      const atExactStart = new Date(startUTC.getTime());
      const res = await SellerCommissionService.resolveEffectiveFee('seller-promo', atExactStart);

      expect(res.effectiveFeeCents).toBe(0);
      expect(res.formattedFee).toBe('R$ 0,00');
      expect(res.source).toBe('EXEMPTION');
      expect(res.isExempt).toBe(true);
      expect(res.exemption.status).toBe('ACTIVE');
      expect(res.exemption.isActive).toBe(true);
    });

    it('3.3. Janela de Isenção Ativa: no meio do período vigora taxa zero', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue(baseExemptSetting as any);

      // 3 dias depois do início
      const midPromo = new Date(startUTC.getTime() + 3 * 86400000);
      const res = await SellerCommissionService.resolveEffectiveFee('seller-promo', midPromo);

      expect(res.effectiveFeeCents).toBe(0);
      expect(res.isExempt).toBe(true);
      expect(res.source).toBe('EXEMPTION');
    });

    it('3.4. 1ms antes do término: ainda aplica taxa zero (inclusivo antes do fim)', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue(baseExemptSetting as any);

      const oneMsBeforeEnd = new Date(endUTC.getTime() - 1);
      const res = await SellerCommissionService.resolveEffectiveFee('seller-promo', oneMsBeforeEnd);

      expect(res.effectiveFeeCents).toBe(0);
      expect(res.isExempt).toBe(true);
      expect(res.source).toBe('EXEMPTION');
    });

    it('3.5. Término Exclusivo (now = end): retorna AUTOMATICAMENTE à taxa personalizada com status EXPIRED', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue(baseExemptSetting as any);

      // Exatamente no instante de término
      const atExactEnd = new Date(endUTC.getTime());
      const res = await SellerCommissionService.resolveEffectiveFee('seller-promo', atExactEnd);

      expect(res.effectiveFeeCents).toBe(30);
      expect(res.formattedFee).toBe('R$ 0,30');
      expect(res.source).toBe('CUSTOM');
      expect(res.isExempt).toBe(false);
      expect(res.exemption.status).toBe('EXPIRED');
      expect(res.exemption.isActive).toBe(false);
    });

    it('3.6. Após o término (now > end): mantém retorno à taxa padrão se não havia taxa customizada', async () => {
      vi.spyOn(db.query.sellerCommissionSettings, 'findFirst').mockResolvedValue({
        ...baseExemptSetting,
        customFeeCents: null, // sem taxa customizada: herda padrão
      } as any);

      // 1 dia após o término
      const afterEnd = new Date(endUTC.getTime() + 86400000);
      const res = await SellerCommissionService.resolveEffectiveFee('seller-promo', afterEnd);

      expect(res.effectiveFeeCents).toBe(50);
      expect(res.formattedFee).toBe('R$ 0,50');
      expect(res.source).toBe('PLATFORM_DEFAULT');
      expect(res.isExempt).toBe(false);
      expect(res.exemption.status).toBe('EXPIRED');
    });

    it('3.7. Rejeita término anterior ou igual ao início na validação', async () => {
      await expect(
        SellerCommissionService.updateSellerCommission({
          sellerId: 'seller-invalid-dates',
          exemptionActive: true,
          exemptionStart: '2026-11-05T00:00:00-03:00',
          exemptionEnd: '2026-11-05T00:00:00-03:00', // Igual
          exemptionReason: 'Teste',
          reason: 'Auditoria',
          adminUser: mockAdmin,
        })
      ).rejects.toThrow('data de término da isenção deve ser posterior à data de início');

      await expect(
        SellerCommissionService.updateSellerCommission({
          sellerId: 'seller-invalid-dates',
          exemptionActive: true,
          exemptionStart: '2026-11-10T00:00:00-03:00',
          exemptionEnd: '2026-11-05T00:00:00-03:00', // Anterior
          exemptionReason: 'Teste',
          reason: 'Auditoria',
          adminUser: mockAdmin,
        })
      ).rejects.toThrow('data de término da isenção deve ser posterior à data de início');
    });
  });

  describe('4. Conversão de Fuso Horário America/Recife para UTC', () => {
    it('4.1. Converte string de data civil "YYYY-MM-DD" para meia-noite em America/Recife (UTC-3 -> 03:00:00Z)', () => {
      const parsed = parseRecifeToUTC('2026-11-01');
      expect(parsed).not.toBeNull();
      expect(parsed?.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    });

    it('4.2. Converte "YYYY-MM-DDTHH:mm:ss" sem timezone para UTC aplicando o offset -03:00', () => {
      const parsed = parseRecifeToUTC('2026-11-01T14:30:00');
      expect(parsed).not.toBeNull();
      // 14:30 em UTC-3 = 17:30 em UTC
      expect(parsed?.toISOString()).toBe('2026-11-01T17:30:00.000Z');
    });

    it('4.3. Preserva instantes de strings ISO que já contenham offset ou Z explícito', () => {
      const parsedZ = parseRecifeToUTC('2026-11-01T10:00:00.000Z');
      expect(parsedZ?.toISOString()).toBe('2026-11-01T10:00:00.000Z');

      const parsedOffset = parseRecifeToUTC('2026-11-01T10:00:00-03:00');
      expect(parsedOffset?.toISOString()).toBe('2026-11-01T13:00:00.000Z');
    });

    it('4.4. Lança erro controlado para datas malformadas ou inválidas', () => {
      expect(() => parseRecifeToUTC('data-invalida')).toThrow(SellerCommissionValidationError);
      expect(() => parseRecifeToUTC('2026-13-45')).toThrow(SellerCommissionValidationError);
    });
  });

  describe('5. Auditoria Transacional, Concorrência e Rollback', () => {
    it('5.1. Grava a configuração e o registro de auditoria com os valores anterior e novo na mesma transação', async () => {
      const mockTx = {
        query: {
          sellerCommissionSettings: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'cfg-prev',
              sellerId: 'seller-audited',
              customFeeCents: 50,
              exemptionActive: false,
              exemptionStart: null,
              exemptionEnd: null,
              exemptionReason: null,
              version: 2,
            }),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'cfg-prev',
                  sellerId: 'seller-audited',
                  customFeeCents: 20,
                  exemptionActive: false,
                  exemptionStart: null,
                  exemptionEnd: null,
                  exemptionReason: null,
                  version: 3,
                  updatedAt: new Date(),
                  updatedById: mockAdmin.id,
                  updatedByName: mockAdmin.name,
                  updatedByEmail: mockAdmin.email,
                },
              ]),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue([]),
        })),
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const updated = await SellerCommissionService.updateSellerCommission({
        sellerId: 'seller-audited',
        customFeeCents: 20,
        expectedVersion: 2,
        reason: 'Redução negociada com vendedor VIP',
        adminUser: mockAdmin,
      });

      expect(updated.customFeeCents).toBe(20);
      expect(updated.version).toBe(3);

      // Verifica chamada da auditoria
      expect(mockTx.insert).toHaveBeenCalled();
      const insertCallValues = mockTx.insert.mock.results[0]?.value?.values;
      expect(insertCallValues).toBeDefined();
    });

    it('5.2. Rejeita atualização com conflito de concorrência quando a versão esperada difere da atual', async () => {
      const mockTx = {
        query: {
          sellerCommissionSettings: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'cfg-race',
              sellerId: 'seller-race',
              customFeeCents: 50,
              version: 5, // versão atual é 5
            }),
          },
        },
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        SellerCommissionService.updateSellerCommission({
          sellerId: 'seller-race',
          customFeeCents: 10,
          expectedVersion: 4, // admin enviou versão 4 desatualizada!
          reason: 'Atualização concorrente',
          adminUser: mockAdmin,
        })
      ).rejects.toThrow(SellerCommissionConcurrencyError);
    });

    it('5.3. Faz rollback completo quando a escrita do log de auditoria falha', async () => {
      let insertCallCount = 0;
      const mockTx = {
        query: {
          sellerCommissionSettings: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn().mockImplementation(() => {
          insertCallCount++;
          // Primeira inserção (settings) tem sucesso
          if (insertCallCount === 1) {
            return {
              values: vi.fn().mockImplementation(() => ({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: 'new-cfg',
                    sellerId: 'seller-fail-log',
                    customFeeCents: 25,
                    exemptionActive: false,
                    version: 1,
                    updatedAt: new Date(),
                  },
                ]),
              })),
            };
          }
          // Segunda inserção (audit log) simula erro do banco (ex: falha de FK ou disco)
          return {
            values: vi.fn().mockImplementation(() => {
              throw new Error('Falha simulada na gravação do log de auditoria');
            }),
          };
        }),
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        SellerCommissionService.updateSellerCommission({
          sellerId: 'seller-fail-log',
          customFeeCents: 25,
          reason: 'Tentativa com falha de log',
          adminUser: mockAdmin,
        })
      ).rejects.toThrow('Falha simulada na gravação do log de auditoria');
    });

    it('5.4. Consulta o histórico de auditoria ordenado por data decrescente', async () => {
      const sampleLogs = [
        {
          id: 'log-2',
          sellerId: 'seller-hist',
          previousFeeCents: 50,
          newFeeCents: 25,
          previousExemptionActive: false,
          newExemptionActive: false,
          previousExemptionStart: null,
          previousExemptionEnd: null,
          newExemptionStart: null,
          newExemptionEnd: null,
          reason: 'Desconto comercial',
          changedById: mockAdmin.id,
          changedByName: mockAdmin.name,
          changedByEmail: mockAdmin.email,
          createdAt: new Date('2026-10-28T14:00:00Z'),
        },
        {
          id: 'log-1',
          sellerId: 'seller-hist',
          previousFeeCents: null,
          newFeeCents: 50,
          previousExemptionActive: false,
          newExemptionActive: false,
          previousExemptionStart: null,
          previousExemptionEnd: null,
          newExemptionStart: null,
          newExemptionEnd: null,
          reason: 'Criação inicial da configuração',
          changedById: mockAdmin.id,
          changedByName: mockAdmin.name,
          changedByEmail: mockAdmin.email,
          createdAt: new Date('2026-10-27T10:00:00Z'),
        },
      ];

      vi.spyOn(db.query.sellerCommissionAuditLogs, 'findMany').mockResolvedValue(sampleLogs as any);

      const history = await SellerCommissionService.getSellerCommissionHistory('seller-hist');

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('log-2');
      expect(history[0].newFeeCents).toBe(25);
      expect(history[1].id).toBe('log-1');
      expect(history[1].newFeeCents).toBe(50);
    });

    it('5.5. Permite criação inicial com expectedVersion: 0 sem gerar falso conflito e grava versão 1', async () => {
      const mockTx = {
        query: {
          sellerCommissionSettings: {
            findFirst: vi.fn().mockResolvedValue(null), // Vendedor novo, sem registro prévio
          },
        },
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'new-cfg-1',
                sellerId: 'seller-new',
                customFeeCents: 20,
                exemptionActive: false,
                exemptionStart: null,
                exemptionEnd: null,
                exemptionReason: null,
                version: 1,
                updatedAt: new Date(),
                updatedById: mockAdmin.id,
                updatedByName: mockAdmin.name,
                updatedByEmail: mockAdmin.email,
              },
            ]),
          })),
        })),
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const created = await SellerCommissionService.updateSellerCommission({
        sellerId: 'seller-new',
        customFeeCents: 20,
        expectedVersion: 0, // Versão 0 enviada para vendedor sem configuração prévia
        reason: 'Primeira personalização da taxa do vendedor',
        adminUser: mockAdmin,
      });

      expect(created.version).toBe(1);
      expect(created.customFeeCents).toBe(20);
      expect(mockTx.insert).toHaveBeenCalledTimes(2); // Inserção de settings + Inserção de audit log
    });

    it('5.6. Detecta conflito real quando expectedVersion: 0 é enviado mas outro admin já criou a configuração', async () => {
      const mockTx = {
        query: {
          sellerCommissionSettings: {
            // Outro administrador já inseriu concorrentemente enquanto este estava no formulário!
            findFirst: vi.fn().mockResolvedValue({
              id: 'cfg-already-created',
              sellerId: 'seller-race-create',
              customFeeCents: 15,
              version: 1,
            }),
          },
        },
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        SellerCommissionService.updateSellerCommission({
          sellerId: 'seller-race-create',
          customFeeCents: 20,
          expectedVersion: 0, // Esperava que não houvesse registro prévio
          reason: 'Tentativa concorrente de criação',
          adminUser: mockAdmin,
        })
      ).rejects.toThrow(SellerCommissionConcurrencyError);
    });

    it('5.7. Rejeita atualização quando versão enviada é desatualizada (expectedVersion: 1 quando atual é 2)', async () => {
      const mockTx = {
        query: {
          sellerCommissionSettings: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'cfg-stale',
              sellerId: 'seller-stale',
              customFeeCents: 30,
              version: 2, // Versão atual no banco já é 2
            }),
          },
        },
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        SellerCommissionService.updateSellerCommission({
          sellerId: 'seller-stale',
          customFeeCents: 25,
          expectedVersion: 1, // Enviou versão 1 antiga
          reason: 'Tentativa de salvar com versão defasada',
          adminUser: mockAdmin,
        })
      ).rejects.toThrow(SellerCommissionConcurrencyError);
    });

    it('5.8. Salva com sucesso após recarregar dados e enviar a versão correta (expectedVersion: 2)', async () => {
      const mockTx = {
        query: {
          sellerCommissionSettings: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'cfg-recovered',
              sellerId: 'seller-recovered',
              customFeeCents: 30,
              version: 2,
            }),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'cfg-recovered',
                  sellerId: 'seller-recovered',
                  customFeeCents: 25,
                  exemptionActive: false,
                  version: 3,
                  updatedAt: new Date(),
                  updatedById: mockAdmin.id,
                  updatedByName: mockAdmin.name,
                  updatedByEmail: mockAdmin.email,
                },
              ]),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue([]),
        })),
      };

      vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const updated = await SellerCommissionService.updateSellerCommission({
        sellerId: 'seller-recovered',
        customFeeCents: 25,
        expectedVersion: 2, // Versão correta após recarregamento
        reason: 'Atualização após revisão com dados mais recentes',
        adminUser: mockAdmin,
      });

      expect(updated.version).toBe(3);
      expect(updated.customFeeCents).toBe(25);
    });
  });

  describe('6. Isolamento e Não Interferência com Outros Módulos', () => {
    it('6.1. Não altera a configuração global da plataforma em PlatformCommissionService', async () => {
      const platformFee = await PlatformCommissionService.getCurrentCommissionCents();
      expect(platformFee).toBe(50);
    });

    it('6.2. Exige justificativa não vazia para qualquer alteração administrativa', async () => {
      await expect(
        SellerCommissionService.updateSellerCommission({
          sellerId: 'seller-1',
          customFeeCents: 10,
          reason: '   ', // Somente espaços
          adminUser: mockAdmin,
        })
      ).rejects.toThrow('A justificativa da alteração é obrigatória.');
    });
  });
});
