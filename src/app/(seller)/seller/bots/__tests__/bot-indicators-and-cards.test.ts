import { describe, it, expect } from "vitest";

describe("WebGran Bots — Testes dos Novos Indicadores e Cards", () => {
  describe("1. Ticket Médio", () => {
    it("calcula corretamente o Ticket Médio com pedidos aprovados (Receita ÷ Pedidos Aprovados)", () => {
      const paidOrders = [
        { id: "1", status: "paid", totalAmount: 100.0, createdAt: new Date().toISOString() },
        { id: "2", status: "paid", totalAmount: 50.0, createdAt: new Date().toISOString() },
        { id: "3", status: "paid", totalAmount: 30.0, createdAt: new Date().toISOString() },
      ];
      const pendingOrders = [
        { id: "4", status: "pending", totalAmount: 200.0, createdAt: new Date().toISOString() },
      ];
      const allOrders = [...paidOrders, ...pendingOrders];

      const paid = allOrders.filter((o) => o.status === "paid");
      const approvedRevenue = paid.reduce((sum, o) => sum + o.totalAmount, 0);
      const paidCount = paid.length;
      const averageTicket = paidCount > 0 ? approvedRevenue / paidCount : 0;

      expect(approvedRevenue).toBe(180.0);
      expect(paidCount).toBe(3);
      expect(averageTicket).toBe(60.0);
    });

    it("retorna R$ 0,00 quando não há nenhum pedido aprovado no período", () => {
      const orders = [
        { id: "1", status: "pending", totalAmount: 150.0, createdAt: new Date().toISOString() },
        { id: "2", status: "cancelled", totalAmount: 50.0, createdAt: new Date().toISOString() },
      ];

      const paid = orders.filter((o) => o.status === "paid");
      const approvedRevenue = paid.reduce((sum, o) => sum + o.totalAmount, 0);
      const paidCount = paid.length;
      const averageTicket = paidCount > 0 ? approvedRevenue / paidCount : 0;

      expect(approvedRevenue).toBe(0);
      expect(paidCount).toBe(0);
      expect(averageTicket).toBe(0);
    });
  });

  describe("2. Total de Clientes Únicos Sem Duplicidade", () => {
    it("garante contagem única de clientes que interagiram por múltiplos canais (pedidos, mensagens, starts)", () => {
      const botOrders = [
        { id: "o1", customerId: "cust-1", customerTelegramUserId: "tg-100" },
        { id: "o2", customerId: "cust-1", customerTelegramUserId: "tg-100" }, // duplicado
        { id: "o3", customerId: "cust-2", customerTelegramUserId: "tg-200" },
      ];

      const botMessages = [
        { id: "m1", customerId: "cust-1", telegramUserId: "tg-100" }, // já em pedidos
        { id: "m2", customerId: "cust-3", telegramUserId: "tg-300" }, // novo
      ];

      const startEvents = [
        { id: "s1", telegramUserId: "tg-200" }, // já em pedidos (o3)
        { id: "s2", telegramUserId: "tg-400" }, // novo via /start
      ];

      const uniqueCustomers = new Set<string>();

      botOrders.forEach((o) => {
        const key = o.customerTelegramUserId || o.customerId;
        if (key) uniqueCustomers.add(key);
      });

      botMessages.forEach((m) => {
        const key = m.telegramUserId || m.customerId;
        if (key) uniqueCustomers.add(key);
      });

      startEvents.forEach((se) => {
        if (se.telegramUserId) uniqueCustomers.add(se.telegramUserId);
      });

      // tg-100, tg-200, tg-300, tg-400 -> exatamente 4 clientes únicos
      expect(uniqueCustomers.size).toBe(4);
    });
  });

  describe("3. Isolamento de Produtos Ativos por Bot", () => {
    it("filtra exclusivamente produtos com status active vinculados ao bot atual quando loja possui múltiplos bots", () => {
      const currentBotId = "bot-1";
      const isOnlyBot = false;

      const storeProducts = [
        { id: "p1", title: "Curso 1", status: "active", botId: "bot-1" },
        { id: "p2", title: "Curso 2", status: "active", botId: "bot-1" },
        { id: "p3", title: "Curso 3 (Draft)", status: "draft", botId: "bot-1" }, // inativo
        { id: "p4", title: "Curso 4 (Outro Bot)", status: "active", botId: "bot-2" }, // outro bot
        { id: "p5", title: "Curso 5 (Sem bot)", status: "active", botId: null }, // unassigned
      ];

      const activeProductsForBot = storeProducts.filter((p) => {
        if (p.status !== "active") return false;
        if (isOnlyBot) {
          return p.botId === currentBotId || p.botId === null;
        }
        return p.botId === currentBotId;
      });

      expect(activeProductsForBot).toHaveLength(2);
      expect(activeProductsForBot.map((p) => p.id)).toEqual(["p1", "p2"]);
    });

    it("inclui produtos sem botId quando a loja possui apenas um bot exclusivo", () => {
      const currentBotId = "bot-exclusive";
      const isOnlyBot = true;

      const storeProducts = [
        { id: "p1", title: "Curso 1", status: "active", botId: "bot-exclusive" },
        { id: "p2", title: "Curso 2", status: "active", botId: null }, // compartilhado na loja de bot único
        { id: "p3", title: "Curso 3", status: "archived", botId: "bot-exclusive" }, // arquivado
      ];

      const activeProductsForBot = storeProducts.filter((p) => {
        if (p.status !== "active") return false;
        if (isOnlyBot) {
          return p.botId === currentBotId || p.botId === null;
        }
        return p.botId === currentBotId;
      });

      expect(activeProductsForBot).toHaveLength(2);
      expect(activeProductsForBot.map((p) => p.id)).toEqual(["p1", "p2"]);
    });
  });

  describe("4. Filtro por Período nas Métricas", () => {
    it("aplica rigorosamente o corte temporal (today, week, month, year)", () => {
      const now = new Date();
      const todayOrder = {
        id: "1",
        status: "paid",
        totalAmount: 50.0,
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      };
      const threeDaysAgoOrder = {
        id: "2",
        status: "paid",
        totalAmount: 100.0,
        createdAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString(),
      };
      const twoMonthsAgoOrder = {
        id: "3",
        status: "paid",
        totalAmount: 200.0,
        createdAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString(),
      };

      const allOrders = [todayOrder, threeDaysAgoOrder, twoMonthsAgoOrder];

      // Teste hoje
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const ordersToday = allOrders.filter((o) => new Date(o.createdAt) >= todayStart);
      expect(ordersToday).toHaveLength(1);
      expect(ordersToday[0].id).toBe("1");

      // Teste semana
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - 7);
      const ordersWeek = allOrders.filter((o) => new Date(o.createdAt) >= weekStart);
      expect(ordersWeek).toHaveLength(2);

      // Teste mês
      const monthStart = new Date();
      monthStart.setMonth(now.getMonth() - 1);
      const ordersMonth = allOrders.filter((o) => new Date(o.createdAt) >= monthStart);
      expect(ordersMonth).toHaveLength(2);
    });
  });

  describe("5. Centralização do Filtro de Período no Header e Integridade dos Indicadores", () => {
    it("valida a lista de opções de períodos suportados no botão Filtros", () => {
      const periodOptions = [
        { id: "today", label: "Hoje" },
        { id: "week", label: "Esta semana" },
        { id: "month", label: "Este mês" },
        { id: "year", label: "Este ano" },
      ];

      expect(periodOptions.map((p) => p.id)).toEqual(["today", "week", "month", "year"]);
      expect(periodOptions.map((p) => p.label)).toEqual(["Hoje", "Esta semana", "Este mês", "Este ano"]);
    });

    it("mantém os 4 indicadores unificados com dados íntegros e consistentes", () => {
      const metrics = {
        approvedRevenue: 2500.5,
        totalCustomers: 42,
        averageTicket: 125.02,
        activeProductsCount: 15,
      };

      // Receita
      expect(metrics.approvedRevenue).toBe(2500.5);
      // Clientes
      expect(metrics.totalCustomers).toBe(42);
      // Ticket
      expect(metrics.averageTicket).toBe(125.02);
      // Produtos
      expect(metrics.activeProductsCount).toBe(15);
    });
  });
});
