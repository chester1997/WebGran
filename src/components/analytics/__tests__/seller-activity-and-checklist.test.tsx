import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SellerSetupChecklist, SellerSetupChecklistData } from "../SellerSetupChecklist";
import { SellerActivityAndChannels } from "../SellerActivityAndChannels";
import { ActivityLogItem, TopProductItem, ChannelItem } from "@/lib/analytics/analytics-service";

describe("SellerSetupChecklist Suite (Apple Design & Contextual Onboarding)", () => {
  it("1. Renderiza os 4 passos e progresso quando houver itens pendentes", () => {
    const checklist: SellerSetupChecklistData = {
      hasPaymentGateway: false,
      hasProducts: false,
      hasBot: false,
      hasSaleNotifications: false,
    };

    const html = renderToStaticMarkup(
      <SellerSetupChecklist checklist={checklist} isPending={false} />
    );

    expect(html).toContain("Próximos passos");
    expect(html).toContain("0 de 4 concluídos");
    expect(html).toContain("Conectar pagamento");
    expect(html).toContain("/seller/recebimentos");
    expect(html).toContain("Criar o primeiro produto");
    expect(html).toContain("/seller/products");
    expect(html).toContain("Conectar o bot");
    expect(html).toContain("Ativar avisos de venda");
    expect(html).toContain("/seller/store");
  });

  it("2. Some completamente (retorna null) quando todos os 4 passos estiverem concluídos", () => {
    const checklist: SellerSetupChecklistData = {
      hasPaymentGateway: true,
      hasProducts: true,
      hasBot: true,
      hasSaleNotifications: true,
    };

    const html = renderToStaticMarkup(
      <SellerSetupChecklist checklist={checklist} isPending={false} />
    );

    expect(html).toBe("");
  });

  it("3. Exibe skeleton suave durante carregamento sem quebrar layout", () => {
    const html = renderToStaticMarkup(
      <SellerSetupChecklist checklist={null} isPending={true} />
    );

    expect(html).toContain("animate-pulse");
  });
});

describe("SellerActivityAndChannels Suite (Apple Design, Microcopy & Isolation)", () => {
  const sampleActivities: ActivityLogItem[] = [
    {
      id: "act-1",
      type: "sale_approved",
      title: "Venda aprovada",
      targetName: "Ana Silva",
      description: "R$ 149,90",
      timestamp: new Date().toISOString(),
      dateFormatted: "01/11/2026",
      timeFormatted: "13:00",
      botName: "Bot VIP",
    },
    {
      id: "act-2",
      type: "payment_pending",
      title: "Cobrança gerada",
      targetName: "Carlos Souza",
      description: "R$ 89,00",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      dateFormatted: "01/11/2026",
      timeFormatted: "12:00",
      botName: "Bot VIP",
    },
    {
      id: "act-3",
      type: "lead",
      title: "Novo /start",
      targetName: "Mariana Costa",
      description: "",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      dateFormatted: "01/11/2026",
      timeFormatted: "11:00",
      botName: "Bot VIP",
    },
  ];

  const sampleProducts: TopProductItem[] = [
    {
      id: "prod-1",
      title: "Acesso Vitalício VIP Club",
      coverUrl: null,
      salesCount: 15,
      revenue: 2250,
      percentage: 75,
    },
  ];

  const sampleChannels: ChannelItem[] = [
    {
      channel: "bot-1",
      label: "Canal VIP",
      revenue: 2250,
      salesCount: 15,
      percentage: 75,
      username: "vip_bot",
      uniqueStarts: 45,
      conversionRate: 33.3,
    },
    {
      channel: "bot-2",
      label: "Canal Free",
      revenue: 750,
      salesCount: 5,
      percentage: 25,
      username: "free_bot",
      uniqueStarts: 120,
      conversionRate: 4.1,
    },
  ];

  it("4. Renderiza atividade recente com textos em português simples e tempo relativo", () => {
    const html = renderToStaticMarkup(
      <SellerActivityAndChannels
        activityLog={sampleActivities}
        topProducts={sampleProducts}
        channels={sampleChannels}
        totalBotsCount={2}
      />
    );

    expect(html).toContain("Atividade recente");
    expect(html).toContain("Venda aprovada");
    expect(html).toContain("Cobrança aguardando pagamento");
    expect(html).toContain("Nova pessoa iniciou conversa");
    expect(html).toContain("Ana Silva");
    expect(html).toContain("Carlos Souza");
    // Tempo relativo e title com data completa
    expect(html).toContain("agora");
    expect(html).toContain("01/11/2026 às 13:00");
  });

  it("5. Mostra nome do bot APENAS quando a loja tiver mais de um bot", () => {
    // Caso com múltiplos bots (>1)
    const htmlMulti = renderToStaticMarkup(
      <SellerActivityAndChannels
        activityLog={sampleActivities}
        topProducts={sampleProducts}
        channels={sampleChannels}
        totalBotsCount={2}
      />
    );
    expect(htmlMulti).toContain("Bot VIP");
    expect(htmlMulti).toContain("Desempenho por bot");
    expect(htmlMulti).toContain("lg:grid-cols-3");

    // Caso com apenas 1 bot
    const singleChannel = [sampleChannels[0]];
    const htmlSingle = renderToStaticMarkup(
      <SellerActivityAndChannels
        activityLog={sampleActivities}
        topProducts={sampleProducts}
        channels={singleChannel}
        totalBotsCount={1}
      />
    );
    // NÃO deve renderizar a tag do bot na atividade recente
    expect(htmlSingle).not.toContain("text-[10px] text-zinc-400 bg-white/[0.04]");
    // NÃO deve renderizar o card 'Desempenho por bot'
    expect(htmlSingle).not.toContain("Desempenho por bot");
    // Grid deve ser 2 colunas para equilibrar perfeitamente
    expect(htmlSingle).toContain("lg:grid-cols-2");
  });

  it("6. Produtos mais vendidos renderiza miniatura, título, unidades e barra de participação", () => {
    const html = renderToStaticMarkup(
      <SellerActivityAndChannels
        activityLog={sampleActivities}
        topProducts={sampleProducts}
        channels={sampleChannels}
        totalBotsCount={2}
      />
    );

    expect(html).toContain("Produtos mais vendidos");
    expect(html).toContain("Acesso Vitalício VIP Club");
    expect(html).toContain("15 unidades vendidas");
    expect(html).toContain("75% do total");
    expect(html).toContain("bg-[#3984FF] rounded-full");
  });

  it("7. Exibe frase exata no estado vazio de mais vendidos", () => {
    const html = renderToStaticMarkup(
      <SellerActivityAndChannels
        activityLog={[]}
        topProducts={[]}
        channels={[]}
        totalBotsCount={1}
      />
    );

    expect(html).toContain("Você ainda não vendeu. Veja como divulgar o seu bot");
    expect(html).toContain("/seller/store");
  });
});
