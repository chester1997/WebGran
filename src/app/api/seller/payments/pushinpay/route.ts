import { NextRequest, NextResponse } from 'next/server';
import { requireSeller, getCurrentStore } from '@/lib/auth';
import { db } from '@/db';
import { sellerPaymentConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { paymentService } from '@/lib/payments/payment-service';
import { hasFeature } from '@/lib/entitlements/entitlement-service';

export async function GET() {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ),
    });

    const isGlobalTokenAvailable = Boolean(process.env.PUSHINPAY_TOKEN && process.env.PUSHINPAY_TOKEN.trim());

    return NextResponse.json({
      success: true,
      hasCustomToken: Boolean(conn && conn.accessTokenEncrypted),
      status: conn?.status || (isGlobalTokenAvailable ? 'active' : 'inactive'),
      isGlobalEnvActive: isGlobalTokenAvailable && !conn,
      updatedAt: conn?.updatedAt || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar dados da PushinPay' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const gatewayAllowed = await hasFeature(seller.id, "payment_gateways_enabled");
    if (!gatewayAllowed) {
      return NextResponse.json({ error: 'A configuração de gateways de pagamento não está disponível no seu plano. Faça upgrade.' }, { status: 403 });
    }

    const body = await req.json();
    const { token, action } = body;

    // Handle Connection Test Action
    if (action === 'test') {
      const tokenToTest = token?.trim() || (await paymentService['pushinPayProvider'].getPushinPayToken(seller.id, store.id));
      if (!tokenToTest) {
        return NextResponse.json({ success: false, error: 'Nenhum token PushinPay fornecido ou configurado.' }, { status: 400 });
      }

      const testRes = await paymentService.testPushinPayConnection(tokenToTest);
      return NextResponse.json(testRes);
    }

    // Save/Update Seller PushinPay Connection
    if (!token || !token.trim()) {
      return NextResponse.json({ error: 'Token PushinPay é obrigatório.' }, { status: 400 });
    }

    // Test token before saving
    const testResult = await paymentService.testPushinPayConnection(token.trim());
    if (!testResult.success) {
      return NextResponse.json({ error: `Falha na validação do token: ${testResult.message}` }, { status: 400 });
    }

    const encryptedToken = encrypt(token.trim());
    const existing = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ),
    });

    if (existing) {
      await db.update(sellerPaymentConnections)
        .set({
          storeId: store.id,
          accessTokenEncrypted: encryptedToken,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(sellerPaymentConnections.id, existing.id));
    } else {
      await db.insert(sellerPaymentConnections).values({
        sellerId: seller.id,
        storeId: store.id,
        provider: 'pushinpay',
        accessTokenEncrypted: encryptedToken,
        status: 'active',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Token da PushinPay configurado e ativado com sucesso!',
    });
  } catch (err: any) {
    console.error('Error saving PushinPay connection:', err);
    return NextResponse.json({ error: err.message || 'Erro ao salvar configuração da PushinPay' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const seller = await requireSeller();
    const store = await getCurrentStore();

    if (!store) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    await db.update(sellerPaymentConnections)
      .set({
        status: 'inactive',
        updatedAt: new Date(),
      })
      .where(and(
        eq(sellerPaymentConnections.sellerId, seller.id),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ));

    return NextResponse.json({ success: true, message: 'Integração PushinPay desativada para a loja.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao desativar PushinPay' }, { status: 500 });
  }
}
