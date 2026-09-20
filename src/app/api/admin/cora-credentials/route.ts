import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const settings = await db.query.systemSettings.findMany({
      where: inArray(systemSettings.key, ['cora_client_id', 'cora_client_secret', 'cora_environment'])
    });

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));
    const clientId = settingsMap.get('cora_client_id') || process.env.CORA_CLIENT_ID || '';
    const hasSecret = Boolean(settingsMap.get('cora_client_secret') || process.env.CORA_CLIENT_SECRET);
    const environment = settingsMap.get('cora_environment') || process.env.CORA_ENV || 'production';

    return NextResponse.json({
      clientId,
      hasSecret,
      environment,
      isConnected: Boolean(clientId && hasSecret)
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao buscar credenciais Cora." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { clientId, clientSecret, environment } = await req.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Client ID e Client Secret são obrigatórios." }, { status: 400 });
    }

    const env = environment === 'stage' ? 'stage' : 'production';

    // 1. Save or Update in system_settings table
    const settingsToSave = [
      { key: 'cora_client_id', value: clientId.trim() },
      { key: 'cora_client_secret', value: clientSecret.trim() },
      { key: 'cora_environment', value: env }
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

    // 2. Test OAuth authentication with Cora Bank
    let authTested = false;
    let authMessage = "Credenciais salvas com sucesso no banco de dados!";

    try {
      const tokenRes = await fetch(
        env === 'stage'
          ? 'https://matls-clients.stage.cora.com.br/token'
          : 'https://matls-clients.api.cora.com.br/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId.trim(),
            client_secret: clientSecret.trim()
          })
        }
      );

      if (tokenRes.ok) {
        authTested = true;
        authMessage = "✅ Conexão testada e autenticada com sucesso no Banco Cora!";
      } else {
        authMessage = "⚠️ Credenciais salvas, mas o Banco Cora retornou erro de autenticação. Verifique os dados.";
      }
    } catch (testErr: any) {
      authMessage = "⚠️ Credenciais salvas. Validação online indisponível no momento.";
    }

    return NextResponse.json({
      success: true,
      authTested,
      message: authMessage
    });
  } catch (error: any) {
    console.error("CORA CREDENTIALS SAVE ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao salvar credenciais Cora." }, { status: 500 });
  }
}
