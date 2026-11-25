-- Migration: 0033_web_sections_vip.sql
-- Loja Web: permite a seção "vip" (card dos Planos VIP) na vitrine.
-- Só troca a regra da coluna "kind"; nenhuma linha é alterada.

ALTER TABLE "web_store_sections" DROP CONSTRAINT IF EXISTS "web_store_sections_kind_check";
ALTER TABLE "web_store_sections"
  ADD CONSTRAINT "web_store_sections_kind_check"
  CHECK ("kind" IN ('hero', 'top15', 'continue', 'combos', 'vip', 'carousel'));
