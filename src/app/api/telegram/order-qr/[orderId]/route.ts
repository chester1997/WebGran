import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    if (!orderId) {
      return new NextResponse("Order ID is required", { status: 400 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: {
        id: true,
        status: true,
        pixExpiresAt: true,
        pixQrCodeBase64: true,
      },
    });

    if (!order) {
      return new NextResponse("Order not found", { status: 404 });
    }

    const orderStatus = (order.status || "").toLowerCase();
    if (orderStatus !== "pending") {
      return new NextResponse(`QR Code is not available for order with status '${order.status}'`, { status: 410 });
    }

    if (order.pixExpiresAt && new Date(order.pixExpiresAt).getTime() < Date.now()) {
      return new NextResponse("QR Code has expired", { status: 410 });
    }

    if (!order.pixQrCodeBase64) {
      return new NextResponse("QR Code image not found for this order", { status: 404 });
    }

    const cleanBase64 = order.pixQrCodeBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    if (!cleanBase64) {
      return new NextResponse("Empty QR Code payload", { status: 404 });
    }

    const imageBuffer = Buffer.from(cleanBase64, "base64");

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": imageBuffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[Order QR API Error]:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
