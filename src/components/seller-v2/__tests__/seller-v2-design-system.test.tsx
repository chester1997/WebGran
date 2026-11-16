import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  IconButton,
  Card,
  PageHeader,
  StatCard,
  Toolbar,
  SearchInput,
  Chip,
  Switch,
  SegmentedControl,
  ConfirmDialog,
  Toast,
  EmptyState,
  UnsavedBar,
  RowMenu,
} from "../index";
import { Plus, Trash2, Edit2, Package, Search } from "lucide-react";

describe("WEBGRAN — ETAPA 3: Design System V2 Component Suite", () => {
  describe("1. Button Component", () => {
    it("renderiza botão padrão (primary) com texto acessível", () => {
      const html = renderToStaticMarkup(<Button>Salvar Produto</Button>);
      expect(html).toContain("Salvar Produto");
      expect(html).toContain("bg-[#3b82f6]");
      expect(html).toContain("text-white");
    });

    it("renderiza variantes secondary, outline, ghost e danger", () => {
      const secHtml = renderToStaticMarkup(<Button variant="secondary">Secundário</Button>);
      expect(secHtml).toContain("bg-[#16161a]");

      const outHtml = renderToStaticMarkup(<Button variant="outline">Outline</Button>);
      expect(outHtml).toContain("bg-transparent");
      expect(outHtml).toContain("border-[#26262a]");

      const ghostHtml = renderToStaticMarkup(<Button variant="ghost">Ghost</Button>);
      expect(ghostHtml).toContain("border-transparent");

      const dangerHtml = renderToStaticMarkup(<Button variant="danger">Excluir</Button>);
      expect(dangerHtml).toContain("bg-[#ef4444]");
    });

    it("renderiza estado de carregamento (isLoading) desabilitando o botão", () => {
      const html = renderToStaticMarkup(<Button isLoading>Processando</Button>);
      expect(html).toContain("disabled");
      expect(html).toContain("animate-spin");
    });

    it("renderiza ícones à esquerda e à direita", () => {
      const html = renderToStaticMarkup(
        <Button leftIcon={<Plus className="w-4 h-4" />} rightIcon={<Package className="w-4 h-4" />}>
          Adicionar
        </Button>
      );
      expect(html).toContain("Adicionar");
      expect(html).toContain("svg");
    });

    it("aplica largura total quando fullWidth=true", () => {
      const html = renderToStaticMarkup(<Button fullWidth>Largura Total</Button>);
      expect(html).toContain("w-full");
    });
  });

  describe("2. IconButton Component", () => {
    it("renderiza botão de ícone com aria-label obrigatório para leitores de tela", () => {
      const html = renderToStaticMarkup(
        <IconButton icon={<Trash2 className="w-4 h-4" />} aria-label="Excluir cupom" variant="danger" />
      );
      expect(html).toContain('aria-label="Excluir cupom"');
      expect(html).toContain("text-[#f87171]");
    });

    it("renderiza spinner quando isLoading=true", () => {
      const html = renderToStaticMarkup(
        <IconButton icon={<Edit2 className="w-4 h-4" />} aria-label="Editar" isLoading />
      );
      expect(html).toContain("disabled");
      expect(html).toContain("animate-spin");
    });
  });

  describe("3. Card Component", () => {
    it("renderiza container com fundo #0e0e10, borda #26262a e radius 16px (rounded-2xl)", () => {
      const html = renderToStaticMarkup(
        <Card>
          <div>Conteúdo do Cartão</div>
        </Card>
      );
      expect(html).toContain("bg-[#0e0e10]");
      expect(html).toContain("border-[#26262a]");
      expect(html).toContain("rounded-2xl");
      expect(html).toContain("Conteúdo do Cartão");
    });

    it("suporta variações de padding (none, sm, md, lg)", () => {
      const noneHtml = renderToStaticMarkup(<Card padding="none">Sem Padding</Card>);
      expect(noneHtml).toContain("p-0");

      const smHtml = renderToStaticMarkup(<Card padding="sm">Small</Card>);
      expect(smHtml).toContain("p-3");

      const lgHtml = renderToStaticMarkup(<Card padding="lg">Large</Card>);
      expect(lgHtml).toContain("p-6");
    });

    it("aplica hover styles quando interactive=true", () => {
      const html = renderToStaticMarkup(<Card interactive>Interativo</Card>);
      expect(html).toContain("hover:border-[#3a3a40]");
      expect(html).toContain("cursor-pointer");
    });
  });

  describe("4. PageHeader Component", () => {
    it("renderiza título, subtítulo, badge e botões de ação de forma responsiva", () => {
      const html = renderToStaticMarkup(
        <PageHeader
          title="Produtos"
          subtitle="Gerencie o catálogo do seu Mini App"
          badge={<span className="badge">12 produtos</span>}
          actions={<Button leftIcon={<Plus className="w-4 h-4" />}>Novo produto</Button>}
        />
      );
      expect(html).toContain("Produtos");
      expect(html).toContain("Gerencie o catálogo do seu Mini App");
      expect(html).toContain("12 produtos");
      expect(html).toContain("Novo produto");
      expect(html).toContain("border-b border-[#1e1e22]");
    });
  });

  describe("5. StatCard Component", () => {
    it("renderiza indicador numérico com título, valor e ícone estilizado", () => {
      const html = renderToStaticMarkup(
        <StatCard
          label="Total de Vendas"
          value="R$ 15.420,00"
          subtext="No período selecionado"
          icon={<Package className="w-5 h-5" />}
          accent="green"
          trend={{ value: "+12%", isPositive: true }}
        />
      );
      expect(html).toContain("Total de Vendas");
      expect(html).toContain("R$ 15.420,00");
      expect(html).toContain("No período selecionado");
      expect(html).toContain("+12%");
      expect(html).toContain("text-emerald-400");
    });

    it("renderiza variações de acento (blue, purple, amber, red)", () => {
      const purpleHtml = renderToStaticMarkup(
        <StatCard
          label="Combos Ativos"
          value="8"
          accent="purple"
          icon={<Package className="w-5 h-5" />}
        />
      );
      expect(purpleHtml).toContain("text-[#c084fc]");

      const amberHtml = renderToStaticMarkup(
        <StatCard
          label="Avisos"
          value="2"
          accent="amber"
          icon={<Package className="w-5 h-5" />}
        />
      );
      expect(amberHtml).toContain("text-[#fbbf24]");
    });
  });

  describe("6. Toolbar & SearchInput Component", () => {
    it("Toolbar renderiza slots de busca e filtros de maneira flexível", () => {
      const html = renderToStaticMarkup(
        <Toolbar
          searchSlot={<SearchInput value="" onChange={() => { }} placeholder="Buscar..." />}
          filterSlot={<div className="filter-chip">Filtro</div>}
        />
      );
      expect(html).toContain("Buscar...");
      expect(html).toContain("filter-chip");
      expect(html).toContain("bg-[#0e0e10]");
    });

    it("SearchInput renderiza role='searchbox', ícone de busca e suporte a clear", () => {
      const emptyHtml = renderToStaticMarkup(
        <SearchInput value="" onChange={() => { }} placeholder="Buscar produtos" />
      );
      expect(emptyHtml).toContain('role="searchbox"');
      expect(emptyHtml).toContain('placeholder="Buscar produtos"');

      const filledHtml = renderToStaticMarkup(
        <SearchInput value="Curso VIP" onChange={() => { }} />
      );
      expect(filledHtml).toContain('value="Curso VIP"');
      expect(filledHtml).toContain('aria-label="Limpar pesquisa"');
    });
  });

  describe("7. Chip Component", () => {
    it("renderiza badge/tag com estilo conforme a variante", () => {
      const activeHtml = renderToStaticMarkup(<Chip label="Ativo" variant="active" />);
      expect(activeHtml).toContain("text-[#4ade80]");
      expect(activeHtml).toContain("rounded-full");

      const dangerHtml = renderToStaticMarkup(<Chip label="Esgotado" variant="danger" />);
      expect(dangerHtml).toContain("text-[#f87171]");
    });

    it("renderiza botão interativo quando onClick é fornecido", () => {
      const html = renderToStaticMarkup(
        <Chip label="Bot Específico" selected onClick={() => { }} />
      );
      expect(html).toContain("<button");
      expect(html).toContain("text-[#60a5fa]");
    });
  });

  describe("8. Switch Component", () => {
    it("renderiza controle com role='switch' e aria-checked='true' quando ativado", () => {
      const html = renderToStaticMarkup(
        <Switch
          checked={true}
          onChange={() => { }}
          label="Notificações Flutuantes"
          description="Exibir popups de vendas no Mini App"
        />
      );
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain("bg-[#22c55e]");
      expect(html).toContain("Notificações Flutuantes");
      expect(html).toContain("Exibir popups de vendas no Mini App");
    });

    it("renderiza aria-checked='false' e cor neutra quando desativado", () => {
      const html = renderToStaticMarkup(
        <Switch checked={false} onChange={() => { }} label="Desativado" />
      );
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain("bg-[#26262a]");
    });
  });

  describe("9. SegmentedControl Component", () => {
    it("renderiza abas com role='tablist' e marca a aba selecionada com aria-selected='true'", () => {
      const options = [
        { id: "all", label: "Todos" },
        { id: "active", label: "Ativos" },
        { id: "inactive", label: "Inativos" },
      ];
      const html = renderToStaticMarkup(
        <SegmentedControl options={options} value="active" onChange={() => { }} />
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain("Ativos");
      expect(html).toContain("bg-[#1f1f24]");
    });
  });

  describe("10. ConfirmDialog Component", () => {
    it("não renderiza nada quando isOpen=false", () => {
      const html = renderToStaticMarkup(
        <ConfirmDialog
          isOpen={false}
          onClose={() => { }}
          onConfirm={() => { }}
          title="Excluir Cupom"
          description="Tem certeza que deseja excluir este cupom?"
        />
      );
      expect(html).toBe("");
    });

    it("renderiza diálogo com role='dialog', aria-modal='true', título e descrição quando isOpen=true", () => {
      const html = renderToStaticMarkup(
        <ConfirmDialog
          isOpen={true}
          onClose={() => { }}
          onConfirm={() => { }}
          title="Excluir Cupom"
          description="Essa ação não pode ser desfeita."
          confirmLabel="Sim, excluir"
          cancelLabel="Voltar"
          variant="danger"
        />
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain("Excluir Cupom");
      expect(html).toContain("Essa ação não pode ser desfeita.");
      expect(html).toContain("Sim, excluir");
      expect(html).toContain("Voltar");
      expect(html).toContain("bg-[#ef4444]");
    });
  });

  describe("11. Toast Component", () => {
    it("renderiza notificação com role='status' para success e role='alert' para error", () => {
      const successHtml = renderToStaticMarkup(
        <Toast type="success" title="Sucesso" message="Banner atualizado com sucesso" onClose={() => { }} />
      );
      expect(successHtml).toContain('role="status"');
      expect(successHtml).toContain("Banner atualizado com sucesso");
      expect(successHtml).toContain("border-emerald-500/30");

      const errorHtml = renderToStaticMarkup(
        <Toast type="error" title="Erro" message="Falha ao salvar" onClose={() => { }} />
      );
      expect(errorHtml).toContain('role="alert"');
      expect(errorHtml).toContain("Falha ao salvar");
      expect(errorHtml).toContain("border-red-500/30");
    });
  });

  describe("12. EmptyState Component", () => {
    it("renderiza estado vazio com ícone, título, mensagem e botão de ação", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="Nenhum produto cadastrado"
          description="Cadastre seu primeiro produto para começar a vender pelo bot."
          action={{
            label: "Cadastrar Produto",
            onClick: () => { },
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      );
      expect(html).toContain("Nenhum produto cadastrado");
      expect(html).toContain("Cadastre seu primeiro produto");
      expect(html).toContain("Cadastrar Produto");
    });
  });

  describe("13. UnsavedBar Component", () => {
    it("renderiza estado desabilitado com 'Nenhuma alteração' quando hasChanges=false", () => {
      const html = renderToStaticMarkup(
        <UnsavedBar hasChanges={false} onSave={() => { }} />
      );
      expect(html).toContain("Nenhuma alteração");
      expect(html).toContain("disabled");
    });

    it("renderiza 'Alterações não salvas' e botão habilitado quando hasChanges=true", () => {
      const html = renderToStaticMarkup(
        <UnsavedBar hasChanges={true} changeCount={3} onSave={() => { }} onReset={() => { }} />
      );
      expect(html).toContain("3 alterações pendentes");
      expect(html).toContain("Descartar");
      expect(html).toContain("Salvar alterações");
      // O botão de salvar não deve ter o atributo disabled quando há alterações
      expect(html).not.toMatch(/<button[^>]*\bdisabled=""[^>]*>[^<]*Salvar/);
    });

    it("renderiza mensagem de feedback de sucesso quando fornecida", () => {
      const html = renderToStaticMarkup(
        <UnsavedBar hasChanges={false} onSave={() => { }} successMessage="Salvo com sucesso!" />
      );
      expect(html).toContain("Salvo com sucesso!");
      expect(html).toContain("text-emerald-400");
    });
  });

  describe("14. RowMenu Component", () => {
    it("renderiza botão gatilho com 3 pontos e aria-haspopup='true'", () => {
      const items = [
        { id: "edit", label: "Editar", onClick: () => { } },
        { id: "delete", label: "Excluir", danger: true, onClick: () => { } },
      ];
      const html = renderToStaticMarkup(<RowMenu items={items} ariaLabel="Ações do produto" />);
      expect(html).toContain('aria-haspopup="true"');
      expect(html).toContain('aria-label="Ações do produto"');
    });
  });
});
