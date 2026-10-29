import { db } from "@/db";
import { sellerGatewayControls } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface SellerGatewayControlRecord {
  gateway: "pushinpay" | "mercadopago" | "syncpay" | string;
  name: string;
  allowNewConnections: boolean;
  allowNewPayments: boolean;
  notes: string | null;
  updatedById: string | null;
  updatedByName: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_GATEWAY_CONTROLS: Record<string, { name: string; allowNewConnections: boolean; allowNewPayments: boolean; notes: string }> = {
  pushinpay: {
    name: "PushinPay (Pix com Split Automático)",
    allowNewConnections: true,
    allowNewPayments: true,
    notes: "Gateway principal de Pix transparente com split instantâneo.",
  },
  mercadopago: {
    name: "Mercado Pago (OAuth 2.0 & Pix)",
    allowNewConnections: true,
    allowNewPayments: true,
    notes: "Integração transparente via conta Mercado Pago do lojista.",
  },
  syncpay: {
    name: "SyncPay (Gateway Parceiro Restrito)",
    allowNewConnections: false,
    allowNewPayments: false,
    notes: "Gateway reservado para planos e assinaturas da plataforma. Conexão direta por vendedores desativada por padrão.",
  },
};

export class SellerGatewayControlService {
  /**
   * Garante idempotentemente a existência da tabela e seed no banco de dados
   */
  static async ensureTableAndSeed(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "seller_gateway_controls" (
          "gateway" text PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "allow_new_connections" boolean DEFAULT true NOT NULL,
          "allow_new_payments" boolean DEFAULT true NOT NULL,
          "notes" text,
          "updated_by_id" uuid,
          "updated_by_name" text,
          "updated_by_email" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
      `);

      for (const [gatewayKey, defaults] of Object.entries(DEFAULT_GATEWAY_CONTROLS)) {
        await db.execute(sql`
          INSERT INTO "seller_gateway_controls" ("gateway", "name", "allow_new_connections", "allow_new_payments", "notes")
          VALUES (${gatewayKey}, ${defaults.name}, ${defaults.allowNewConnections}, ${defaults.allowNewPayments}, ${defaults.notes})
          ON CONFLICT ("gateway") DO NOTHING;
        `);
      }
    } catch (err) {
      console.warn("[SellerGatewayControlService] Aviso ao verificar tabela:", err);
    }
  }

  /**
   * Retorna os controles de todos os gateways
   */
  static async getAllControls(): Promise<SellerGatewayControlRecord[]> {
    try {
      if (typeof db?.select !== 'function') {
        throw new Error("db.select not available");
      }
      await this.ensureTableAndSeed();
      const records = await db.select().from(sellerGatewayControls);
      
      const foundGateways = new Set(records.map((r) => r.gateway));
      const result: SellerGatewayControlRecord[] = records.map((r) => ({
        gateway: r.gateway,
        name: r.name,
        allowNewConnections: Boolean(r.allowNewConnections),
        allowNewPayments: Boolean(r.allowNewPayments),
        notes: r.notes,
        updatedById: r.updatedById,
        updatedByName: r.updatedByName,
        updatedByEmail: r.updatedByEmail,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      }));

      // Adiciona gateways default que porventura não estejam persistidos
      for (const [key, val] of Object.entries(DEFAULT_GATEWAY_CONTROLS)) {
        if (!foundGateways.has(key)) {
          result.push({
            gateway: key,
            name: val.name,
            allowNewConnections: val.allowNewConnections,
            allowNewPayments: val.allowNewPayments,
            notes: val.notes,
            updatedById: null,
            updatedByName: null,
            updatedByEmail: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Ordena: pushinpay, mercadopago, syncpay, outros
      const sortOrder = ["pushinpay", "mercadopago", "syncpay"];
      return result.sort((a, b) => {
        const idxA = sortOrder.indexOf(a.gateway);
        const idxB = sortOrder.indexOf(b.gateway);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      console.error("[SellerGatewayControlService] Erro ao buscar controles, retornando defaults:", err);
      return Object.entries(DEFAULT_GATEWAY_CONTROLS).map(([key, val]) => ({
        gateway: key,
        name: val.name,
        allowNewConnections: val.allowNewConnections,
        allowNewPayments: val.allowNewPayments,
        notes: val.notes,
        updatedById: null,
        updatedByName: null,
        updatedByEmail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
  }

  /**
   * Retorna o controle de um gateway individual
   */
  static async getGatewayControl(gateway: string): Promise<{ allowNewConnections: boolean; allowNewPayments: boolean; name: string }> {
    try {
      if (typeof db?.select === 'function') {
        const records = await db
          .select()
          .from(sellerGatewayControls)
          .where(eq(sellerGatewayControls.gateway, gateway))
          .limit(1);

        if (records.length > 0) {
          return {
            allowNewConnections: Boolean(records[0].allowNewConnections),
            allowNewPayments: Boolean(records[0].allowNewPayments),
            name: records[0].name,
          };
        }
      }
    } catch (err) {
      console.warn(`[SellerGatewayControlService] Fallback default para gateway ${gateway}:`, err);
    }

    const fallback = DEFAULT_GATEWAY_CONTROLS[gateway] || {
      name: gateway,
      allowNewConnections: true,
      allowNewPayments: true,
    };

    return {
      allowNewConnections: fallback.allowNewConnections,
      allowNewPayments: fallback.allowNewPayments,
      name: fallback.name,
    };
  }

  /**
   * Valida se novos pagamentos/vendas estão liberados para o gateway
   */
  static async isPaymentAllowed(gateway: string): Promise<boolean> {
    const ctrl = await this.getGatewayControl(gateway);
    return ctrl.allowNewPayments;
  }

  /**
   * Valida se novas conexões/vínculos de conta estão liberados para o gateway
   */
  static async isConnectionAllowed(gateway: string): Promise<boolean> {
    const ctrl = await this.getGatewayControl(gateway);
    return ctrl.allowNewConnections;
  }

  /**
   * Atualiza a configuração de um gateway pelo Administrador
   */
  static async updateGatewayControl(
    gateway: string,
    params: {
      allowNewConnections?: boolean;
      allowNewPayments?: boolean;
      notes?: string | null;
      adminUser: { id: string; name?: string | null; email?: string | null };
    }
  ): Promise<SellerGatewayControlRecord> {
    await this.ensureTableAndSeed();

    const existing = await db
      .select()
      .from(sellerGatewayControls)
      .where(eq(sellerGatewayControls.gateway, gateway))
      .limit(1);

    const now = new Date();
    const defaults = DEFAULT_GATEWAY_CONTROLS[gateway] || {
      name: gateway,
      allowNewConnections: true,
      allowNewPayments: true,
      notes: null,
    };

    const newConnections = params.allowNewConnections !== undefined 
      ? params.allowNewConnections 
      : (existing.length > 0 ? existing[0].allowNewConnections : defaults.allowNewConnections);

    const newPayments = params.allowNewPayments !== undefined 
      ? params.allowNewPayments 
      : (existing.length > 0 ? existing[0].allowNewPayments : defaults.allowNewPayments);

    const newNotes = params.notes !== undefined 
      ? params.notes 
      : (existing.length > 0 ? existing[0].notes : defaults.notes);

    if (existing.length > 0) {
      await db
        .update(sellerGatewayControls)
        .set({
          allowNewConnections: newConnections,
          allowNewPayments: newPayments,
          notes: newNotes,
          updatedById: params.adminUser.id,
          updatedByName: params.adminUser.name || null,
          updatedByEmail: params.adminUser.email || null,
          updatedAt: now,
        })
        .where(eq(sellerGatewayControls.gateway, gateway));
    } else {
      await db.insert(sellerGatewayControls).values({
        gateway,
        name: defaults.name,
        allowNewConnections: newConnections,
        allowNewPayments: newPayments,
        notes: newNotes,
        updatedById: params.adminUser.id,
        updatedByName: params.adminUser.name || null,
        updatedByEmail: params.adminUser.email || null,
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log("[ADMIN_AUDIT_GATEWAY_CONTROL]", JSON.stringify({
      adminId: params.adminUser.id,
      adminEmail: params.adminUser.email,
      gateway,
      allowNewConnections: newConnections,
      allowNewPayments: newPayments,
      timestamp: now.toISOString(),
    }));

    return {
      gateway,
      name: defaults.name,
      allowNewConnections: newConnections,
      allowNewPayments: newPayments,
      notes: newNotes,
      updatedById: params.adminUser.id,
      updatedByName: params.adminUser.name || null,
      updatedByEmail: params.adminUser.email || null,
      createdAt: (existing[0]?.createdAt || now).toISOString(),
      updatedAt: now.toISOString(),
    };
  }
}
