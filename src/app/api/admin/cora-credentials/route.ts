import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings, invoices } from "@/db/schema";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { coraProvider } from "@/lib/payments/providers/cora";

async function ensureSystemSettingsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error("Auto-create system_settings error:", err);
  }
}

function maskClientId(id: string): string {
  if (!id) return "";
  if (id.length <= 4) return "••••";
  return `••••••••••••${id.slice(-4)}`;
}

export async function GET() {
  try {
    await requireAdmin();
    await ensureSystemSettingsTable();

    let settings: any[] = [];
    try {
      settings = await db.query.systemSettings.findMany({
        where: inArray(systemSettings.key, [
          'cora_client_id', 
          'cora_cert_pem', 
          'cora_key_pem', 
          'cora_environment',
          'cora_last_verified_at'
        ])
      });
    } catch {
      settings = [];
    }

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    const clientId = settingsMap.get('cora_client_id') || process.env.CORA_CLIENT_ID || '';
    const hasCert = Boolean(settingsMap.get('cora_cert_pem') || process.env.CORA_CERT_PEM);
    const hasKey = Boolean(settingsMap.get('cora_key_pem') || process.env.CORA_KEY_PEM);
    const environment = (settingsMap.get('cora_environment') as 'stage' | 'production') || process.env.CORA_ENV || 'production';
    const lastVerifiedAt = settingsMap.get('cora_last_verified_at') || null;

    const isConnected = Boolean(clientId && hasCert && hasKey);

    const lastInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.provider, 'cora'),
      orderBy: [desc(invoices.createdAt)],
    });

    return NextResponse.json({
      clientIdMasked: maskClientId(clientId),
      hasCert,
      hasKey,
      environment,
      lastVerifiedAt,
      isConnected,
      lastInvoice: lastInvoice ? {
        id: lastInvoice.externalId || lastInvoice.id,
        status: lastInvoice.status,
        amount: Number(lastInvoice.amount),
        createdAt: lastInvoice.createdAt ? new Date(lastInvoice.createdAt).toISOString() : null,
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao buscar credenciais Cora." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    await ensureSystemSettingsTable();

    const { clientId, certPem, keyPem, environment } = await req.json();

    if (!clientId || !clientId.trim()) {
      return NextResponse.json({ error: "Client ID é obrigatório." }, { status: 400 });
    }
    if (!certPem || !certPem.trim()) {
      return NextResponse.json({ error: "Certificado (.pem) é obrigatório." }, { status: 400 });
    }
    if (!keyPem || !keyPem.trim()) {
      return NextResponse.json({ error: "Chave Privada (.key) é obrigatória." }, { status: 400 });
    }

    const env = environment === 'stage' ? 'stage' : 'production';

    // REAL MTLS TEST WITH CORA BANK TOKEN ENDPOINT
    try {
      await coraProvider.authenticate({
        clientId: clientId.trim(),
        certPem: certPem.trim(),
        keyPem: keyPem.trim(),
        environment: env
      });
    } catch (authErr: any) {
      console.error("Cora mTLS Real Auth Test Failed:", authErr);
      return NextResponse.json(
        { 
          error: `Falha na autenticação mTLS com o Banco Cora: ${authErr.message || 'Certificado ou Client ID inválidos.'}`
        }, 
        { status: 400 }
      );
    }

    // AUTH TEST PASSED -> Save in system_settings table
    const nowIso = new Date().toISOString();
    const settingsToSave = [
      { key: 'cora_client_id', value: clientId.trim() },
      { key: 'cora_cert_pem', value: certPem.trim() },
      { key: 'cora_key_pem', value: keyPem.trim() },
      { key: 'cora_environment', value: env },
      { key: 'cora_last_verified_at', value: nowIso }
    ];

    for (const item of settingsToSave) {
      const existing = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, item.key)
      });

      if (existing) {
        await db
          .update(systemSettings)
          .set({ value: item.value, updatedAt: new Date() })
          .where(eq(systemSettings.id, existing.id));
      } else {
        await db.insert(systemSettings).values({
          key: item.key,
          value: item.value
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "🟢 Autenticação mTLS testada e confirmada com sucesso! Conta Cora conectada.",
      lastVerifiedAt: nowIso
    });
  } catch (error: any) {
    console.error("CORA CREDENTIALS SAVE ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao salvar credenciais Cora." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await ensureSystemSettingsTable();

    const keysToDelete = [
      'cora_client_id', 
      'cora_cert_pem', 
      'cora_key_pem', 
      'cora_environment', 
      'cora_last_verified_at'
    ];

    for (const key of keysToDelete) {
      const existing = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, key)
      });
      if (existing) {
        await db.delete(systemSettings).where(eq(systemSettings.id, existing.id));
      }
    }

    return NextResponse.json({
      success: true,
      message: "Conta Cora desconectada com sucesso."
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao desconectar conta Cora." }, { status: 500 });
  }
}
