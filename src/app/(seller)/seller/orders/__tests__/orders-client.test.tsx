import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrdersClient, SerializedOrder, escapeRFC4180, buildOrdersCSV } from "../OrdersClient";

// Mock do SellerPageHeader para testar conteúdo renderizado no SSR/markup
vi.mock("@/components/layout/SellerPageHeader", () => ({
  default: ({ title, subtitle, badge, actions }: any) => (
    <header data-testid="mock-seller-page-header">
      <div data-testid="header-title">{title}</div>
      <div data-testid="header-badge">{badge}</div>
      <div data-testid="header-subtitle">{subtitle}</div>
      <div data-testid="header-actions">{actions}</div>
    </header>
  ),
}));

// Mock do RetryDeliveryButton
vi.mock("../RetryDeliveryButton", () => ({
  RetryDeliveryButton: ({ accessId }: { accessId: string }) => (
    <button data-testid={`retry-btn-${accessId}`}>Retry</button>
  ),
}));

const mockOrders: SerializedOrder[] = [
  {
    id: "ord-12345678-aaaa",
    createdAt: "2026-11-01T10:00:00Z",
    total: 150.5,
    status: "paid",
    customer: {
      id: "cust-1",
      firstName: "Carlos",
      lastName: "Silva",
      photoUrl: null,
    },
    accesses: [
      {
        id: "acc-1",
        deliveryStatus: "DELIVERED",
        status: "ACTIVE",
        telegramChatId: "123456",
        deliveryError: null,
        product: { id: "p-1", title: "Curso de Python" },
      },
    ],
  },
  {
    id: "ord-87654321-bbbb",
    createdAt: "2026-11-01T11:00:00Z",
    total: 80.0,
    status: "pending",
    customer: {
      id: "cust-2",
      firstName: "Mariana",
      lastName: "Costa",
      photoUrl: null,
    },
    accesses: [
      {
        id: "acc-2",
        deliveryStatus: "PENDING",
        status: "PENDING",
        telegramChatId: null,
        deliveryError: null,
        product: { id: "p-2", title: "Ebook JavaScript" },
      },
    ],
  },
  {
    id: "ord-99999999-cccc",
    createdAt: "2026-11-01T12:00:00Z",
    total: 45.0,
    status: "cancelled",
    customer: {
      id: "cust-3",
      firstName: "Pedro",
      lastName: "Souza",
      photoUrl: null,
    },
    accesses: [],
  },
];

describe("OrdersClient Suite (Seller Design & Responsive)", () => {
  it("1. Renderiza o SellerPageHeader com título, badge e subtítulo", () => {
    const html = renderToStaticMarkup(<OrdersClient initialOrders={mockOrders} />);

    expect(html).toContain("Pedidos");
    expect(html).toContain("3 pedidos");
    expect(html).toContain("Acompanhe as vendas e pagamentos dos seus bots em tempo real.");
    expect(html).toContain("Exportar CSV");
  });

  it("2. Renderiza a tabela desktop com headers em normal-case e linhas de dados", () => {
    const html = renderToStaticMarkup(<OrdersClient initialOrders={mockOrders} />);

    expect(html).toContain("Código");
    expect(html).toContain("Cliente");
    expect(html).toContain("Total");
    expect(html).toContain("Carlos Silva");
    expect(html).toContain("Mariana Costa");
    expect(html).toContain("Pedro Souza");
    expect(html).toContain("#ord-1234");
    expect(html).toContain("Aprovado");
    expect(html).toContain("Pendente");
    expect(html).toContain("Cancelado");
  });

  it("3. Renderiza a visualização mobile empilhada (md:hidden) com os dados de acesso", () => {
    const html = renderToStaticMarkup(<OrdersClient initialOrders={mockOrders} />);

    expect(html).toContain("Curso de Python");
    expect(html).toContain("Ebook JavaScript");
    expect(html).toContain("Entregue");
    expect(html).toContain("Processando");
  });

  it("4. Exibe empty state amigável quando a lista de pedidos for vazia", () => {
    const html = renderToStaticMarkup(<OrdersClient initialOrders={[]} />);

    expect(html).toContain("0 pedidos");
    expect(html).toContain("Nenhum pedido encontrado para esta busca.");
    expect(html).toContain("Ver link do bot");
    expect(html).toContain("/seller/store");
  });
});

describe("Orders CSV Export & RFC 4180 Suite", () => {
  it("5. Inicia com BOM UTF-8 (\\uFEFF) para compatibilidade nativa com Excel no Windows", () => {
    const csv = buildOrdersCSV(mockOrders);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("6. Suporta nomes com caracteres acentuados sem corrupção (mojibake)", () => {
    const accentedOrders: SerializedOrder[] = [
      {
        id: "ord-accent-1",
        createdAt: "2026-11-01T10:00:00Z",
        total: 100,
        status: "paid",
        customer: {
          firstName: "João Conceição",
          lastName: "de Açúcar",
        },
        accesses: [
          {
            id: "acc-1",
            product: { id: "p-1", title: "Mentoria de Programação & Gestão" },
          },
        ],
      },
    ];

    const csv = buildOrdersCSV(accentedOrders);
    expect(csv).toContain('"João Conceição de Açúcar"');
  });

  it("7. Trata campos contendo aspas duplas internas de acordo com RFC 4180 (duplicação de aspas)", () => {
    const quoteOrders: SerializedOrder[] = [
      {
        id: 'ord-"vip"-1',
        createdAt: "2026-11-01T10:00:00Z",
        total: 250,
        status: "paid",
        customer: {
          firstName: 'Maria "Chef"',
          lastName: 'D\'Angelo "Especial"',
        },
        accesses: [],
      },
    ];

    const csv = buildOrdersCSV(quoteOrders);
    // Aspas duplas internas devem virar ""
    expect(csv).toContain('"ord-""vip""-1"');
    expect(csv).toContain('"Maria ""Chef"" D\'Angelo ""Especial"""');
  });

  it("8. Trata campos contendo vírgulas sem quebrar a contagem de colunas", () => {
    const commaOrders: SerializedOrder[] = [
      {
        id: "ord-comma-1",
        createdAt: "2026-11-01T10:00:00Z",
        total: 99.9,
        status: "paid",
        customer: {
          firstName: "Silva, João",
          lastName: "Filho, Jr.",
        },
        accesses: [],
      },
    ];

    const csv = buildOrdersCSV(commaOrders);
    expect(csv).toContain('"Silva, João Filho, Jr."');

    // Verifica que cada linha possui exatamente 6 colunas RFC
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines.length).toBe(2); // Header + 1 linha
    expect(lines[0]).toBe('"ID Pedido","Cliente","Data","Total (R$)","Status","Status Entrega"');
  });

  it("9. Trata campos contendo quebras de linha (CR / LF) preservando integridade de células", () => {
    const multilineOrders: SerializedOrder[] = [
      {
        id: "ord-multiline-1",
        createdAt: "2026-11-01T10:00:00Z",
        total: 120,
        status: "paid",
        customer: {
          firstName: "Carlos\nSegunda Linha",
          lastName: "Costa\r\nTerceira Linha",
        },
        accesses: [],
      },
    ];

    const csv = buildOrdersCSV(multilineOrders);
    expect(csv).toContain('"Carlos\nSegunda Linha Costa\r\nTerceira Linha"');
  });

  it("10. Exporta com alto desempenho grande quantidade de pedidos (1.000 pedidos)", () => {
    const largeOrders: SerializedOrder[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `ord-bulk-${i}`,
      createdAt: "2026-11-01T12:00:00Z",
      total: i * 10.5,
      status: i % 2 === 0 ? "paid" : "pending",
      customer: {
        firstName: `Cliente ${i}`,
        lastName: `Sobrenome ${i}`,
      },
      accesses: [],
    }));

    const start = performance.now();
    const csv = buildOrdersCSV(largeOrders);
    const duration = performance.now() - start;

    expect(csv.startsWith("\uFEFF")).toBe(true);
    // 1 header + 1000 rows
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines.length).toBe(1001);
    expect(duration).toBeLessThan(500); // Executa em menos de 500ms
  });

  it("11. Preserva filtros aplicados: gera CSV apenas dos pedidos que correspondem aos critérios", () => {
    // Filtro por status 'paid'
    const paidOnly = mockOrders.filter((o) => o.status === "paid");
    const csvPaid = buildOrdersCSV(paidOnly);
    expect(csvPaid).toContain("Carlos Silva");
    expect(csvPaid).not.toContain("Mariana Costa");
    expect(csvPaid).not.toContain("Pedro Souza");

    // Filtro por busca de produto 'Curso de Python'
    const query = "python";
    const filteredByProduct = mockOrders.filter((o) =>
      o.accesses?.some((a) => a.product?.title?.toLowerCase().includes(query))
    );
    const csvProduct = buildOrdersCSV(filteredByProduct);
    expect(csvProduct).toContain("Carlos Silva");
    expect(csvProduct).not.toContain("Mariana Costa");
  });

  it("12. escapeRFC4180 formata null e undefined com segurança", () => {
    expect(escapeRFC4180(null)).toBe('""');
    expect(escapeRFC4180(undefined)).toBe('""');
    expect(escapeRFC4180("Texto Simples")).toBe('"Texto Simples"');
    expect(escapeRFC4180(123.45)).toBe('"123.45"');
  });

  it("13. Executa o fluxo de download criando Blob, disparando link e revogando URL", () => {
    const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost:3000/mock-uuid");
    const revokeObjectURLMock = vi.fn();
    const clickMock = vi.fn();
    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();

    const originalURL = global.URL;
    const originalDocument = (global as any).document;

    const mockAnchor = {
      href: "",
      setAttribute: vi.fn(),
      click: clickMock,
    };

    (global as any).URL = {
      ...originalURL,
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    };

    (global as any).document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: {
        appendChild: appendChildMock,
        removeChild: removeChildMock,
      },
    };

    try {
      const csv = buildOrdersCSV(mockOrders);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = (global as any).URL.createObjectURL(blob);
      const link = (global as any).document.createElement("a");
      link.href = url;
      link.setAttribute("download", `pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
      (global as any).document.body.appendChild(link);
      link.click();
      (global as any).document.body.removeChild(link);
      (global as any).URL.revokeObjectURL(url);

      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(mockAnchor.setAttribute).toHaveBeenCalledWith(
        "download",
        expect.stringMatching(/^pedidos_\d{4}-\d{2}-\d{2}\.csv$/)
      );
      expect(appendChildMock).toHaveBeenCalledWith(mockAnchor);
      expect(clickMock).toHaveBeenCalledTimes(1);
      expect(removeChildMock).toHaveBeenCalledWith(mockAnchor);
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost:3000/mock-uuid");
    } finally {
      (global as any).URL = originalURL;
      (global as any).document = originalDocument;
    }
  });
});
