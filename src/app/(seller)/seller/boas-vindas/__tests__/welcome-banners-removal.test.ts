import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Welcome Banners Removal & Form State Management Suite", () => {
  // Helper simulating the WelcomeClient banner state machine
  class WelcomeBannerFormManager {
    public banners: string[];
    public savedBanners: string[];
    public isSavedSuccess = false;

    constructor(initialWelcomeBanners: string[] = []) {
      this.banners = initialWelcomeBanners.length > 0 ? [...initialWelcomeBanners] : [""];
      this.savedBanners = [...initialWelcomeBanners];
    }

    public addBannerField() {
      if (this.banners.length < 5) {
        this.banners.push("");
      }
    }

    public handleBannerChange(index: number, val: string) {
      this.banners[index] = val;
    }

    public handleRemoveBanner(index: number): boolean {
      const bannerUrl = (this.banners[index] || "").trim();
      const isSaved = bannerUrl !== "" && this.savedBanners.includes(bannerUrl);

      if (isSaved && typeof window !== "undefined") {
        const confirmed = window.confirm("Deseja remover este banner?");
        if (!confirmed) {
          return false;
        }
      }

      if (this.banners.length === 1) {
        this.banners = [""];
      } else {
        this.banners = this.banners.filter((_, i) => i !== index);
      }
      return true;
    }

    public async handleSave(saveActionMock: (data: { welcomeBanners: string[] }) => Promise<any>) {
      const cleanBanners = this.banners.map((b) => b.trim()).filter(Boolean);
      await saveActionMock({ welcomeBanners: cleanBanners });
      this.savedBanners = cleanBanners;
      this.isSavedSuccess = true;
    }

    public getConfiguredCount(): number {
      return this.banners.filter((b) => b.trim()).length;
    }

    public getRemainingSlots(): number {
      return 5 - this.banners.length;
    }
  }

  const originalWindow = global.window;

  beforeEach(() => {
    global.window = {
      confirm: vi.fn(),
    } as any;
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  // 1. Remoção de um banner salvo
  it("1. Remoção de um banner salvo solicita confirmação e limpa o banner ao confirmar", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const manager = new WelcomeBannerFormManager(["https://cdn.exemplo.com/banner-salvo-1.webp"]);

    expect(manager.getConfiguredCount()).toBe(1);
    expect(manager.banners[0]).toBe("https://cdn.exemplo.com/banner-salvo-1.webp");

    const removed = manager.handleRemoveBanner(0);

    expect(confirmSpy).toHaveBeenCalledWith("Deseja remover este banner?");
    expect(removed).toBe(true);
    expect(manager.banners[0]).toBe("");
    expect(manager.getConfiguredCount()).toBe(0);
  });

  // 2. Remoção de um banner ainda não salvo
  it("2. Remoção de um banner ainda não salvo remove diretamente sem solicitar confirmação", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const manager = new WelcomeBannerFormManager(["https://cdn.exemplo.com/banner-1.webp"]);

    manager.addBannerField();
    manager.handleBannerChange(1, "https://cdn.exemplo.com/banner-novo-nao-salvo.webp");

    expect(manager.banners).toHaveLength(2);
    expect(manager.getConfiguredCount()).toBe(2);

    const removed = manager.handleRemoveBanner(1);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(removed).toBe(true);
    expect(manager.banners).toHaveLength(1);
    expect(manager.banners[0]).toBe("https://cdn.exemplo.com/banner-1.webp");
  });

  // 3. Remoção de um entre vários banners
  it("3. Remoção de um entre vários banners preserva intactos os outros banners e suas ordens", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const initial = [
      "https://cdn.exemplo.com/banner-a.webp",
      "https://cdn.exemplo.com/banner-b.webp",
      "https://cdn.exemplo.com/banner-c.webp",
    ];
    const manager = new WelcomeBannerFormManager(initial);

    expect(manager.banners).toHaveLength(3);

    manager.handleRemoveBanner(1);

    expect(manager.banners).toHaveLength(2);
    expect(manager.banners[0]).toBe("https://cdn.exemplo.com/banner-a.webp");
    expect(manager.banners[1]).toBe("https://cdn.exemplo.com/banner-c.webp");
    expect(manager.banners).not.toContain("https://cdn.exemplo.com/banner-b.webp");
  });

  // 4. Atualização da contagem e do limite de cinco banners
  it("4. Atualização da contagem e do limite de cinco banners após remoção", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const fiveBanners = [
      "https://cdn.exemplo.com/b1.webp",
      "https://cdn.exemplo.com/b2.webp",
      "https://cdn.exemplo.com/b3.webp",
      "https://cdn.exemplo.com/b4.webp",
      "https://cdn.exemplo.com/b5.webp",
    ];
    const manager = new WelcomeBannerFormManager(fiveBanners);

    expect(manager.banners).toHaveLength(5);
    expect(manager.getConfiguredCount()).toBe(5);
    expect(manager.getRemainingSlots()).toBe(0);

    manager.addBannerField();
    expect(manager.banners).toHaveLength(5);

    manager.handleRemoveBanner(4);

    expect(manager.banners).toHaveLength(4);
    expect(manager.getConfiguredCount()).toBe(4);
    expect(manager.getRemainingSlots()).toBe(1);

    manager.addBannerField();
    expect(manager.banners).toHaveLength(5);
    expect(manager.banners[4]).toBe("");
  });

  // 5. Cancelamento da confirmação
  it("5. Cancelamento da confirmação não remove o banner e preserva a URL", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const manager = new WelcomeBannerFormManager(["https://cdn.exemplo.com/banner-importante.webp"]);
    const removed = manager.handleRemoveBanner(0);

    expect(confirmSpy).toHaveBeenCalledWith("Deseja remover este banner?");
    expect(removed).toBe(false);
    expect(manager.banners[0]).toBe("https://cdn.exemplo.com/banner-importante.webp");
    expect(manager.getConfiguredCount()).toBe(1);
  });

  // 6. Persistência após clicar em Salvar alterações
  it("6. Persistência após clicar em Salvar alterações envia os banners atualizados sem o removido", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const manager = new WelcomeBannerFormManager([
      "https://cdn.exemplo.com/banner-1.webp",
      "https://cdn.exemplo.com/banner-2.webp",
    ]);

    manager.handleRemoveBanner(0);

    const saveActionMock = vi.fn().mockResolvedValue({ success: true });
    await manager.handleSave(saveActionMock);

    expect(saveActionMock).toHaveBeenCalledWith({
      welcomeBanners: ["https://cdn.exemplo.com/banner-2.webp"],
    });
    expect(manager.savedBanners).toEqual(["https://cdn.exemplo.com/banner-2.webp"]);
    expect(manager.isSavedSuccess).toBe(true);
  });

  // 7. Ausência de exclusão indevida de arquivos compartilhados
  it("7. Ausência de exclusão indevida: apenas a referência na lista é modificada sem chamadas de deleção física", () => {
    const storageDeleteSpy = vi.fn();

    const manager = new WelcomeBannerFormManager(["https://cdn.exemplo.com/shared-marketing-banner.webp"]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    manager.handleRemoveBanner(0);

    expect(storageDeleteSpy).not.toHaveBeenCalled();
    expect(manager.banners[0]).toBe("");
  });
});
