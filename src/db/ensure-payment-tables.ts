/**
 * As estruturas de tabelas e colunas de pagamentos e split (seller_payment_connections,
 * payment_webhook_events, orders e platform_split_audit_logs) são gerenciadas
 * exclusivamente pela migração formal (drizzle/0007_platform_commission_and_split_audit.sql).
 *
 * A execução dinâmica de DDL em runtime via HTTP foi descontinuada para eliminar
 * riscos de concorrência, contenção de locks de catálogo e descompasso entre sessões stateless.
 */
export async function ensurePaymentTables(): Promise<void> {
  // No-op em runtime. Estruturas garantidas formalmente via migração SQL pré-deploy.
}
