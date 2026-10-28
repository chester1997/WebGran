import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeId, productId, customerTelegramId } = body || {};

    if (!storeId || !productId || !customerTelegramId) {
      return NextResponse.json(
        { error: 'Parâmetros storeId, productId e customerTelegramId são obrigatórios.' },
        { status: 400 }
      );
    }

    // Mercado Pago direct store checkout is temporarily disabled for sellers
    return NextResponse.json(
      { error: 'O recebimento via Mercado Pago está temporariamente desativado para lojistas. Utilize o checkout via Pix da loja (PushinPay).' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error processing checkout:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar o checkout.' },
      { status: 500 }
    );
  }
}
