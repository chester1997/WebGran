/**
 * As tabelas e constraints de comissão da plataforma (platform_commission_settings e
 * platform_commission_audit_logs) são gerenciadas exclusivamente pela migração formal
 * (drizzle/0007_platform_commission_and_split_audit.sql).
 *
 * A execução dinâmica de DDL em runtime via HTTP foi descontinuada para eliminar
 * riscos de concorrência, contenção de locks de catálogo e descompasso entre sessões stateless.
 */
export async function ensureCommissionSettings(): Promise<void> {
  // No-op em runtime. Estruturas garantidas formalmente via migração SQL pré-deploy.
}
