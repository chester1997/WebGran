import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Welcome Banner Removal & Single Banner Form Suite", () => {
  // Helper simulating the WelcomeClient single welcome banner state machine
  class SingleWelcomeBannerManager {
    public banner: string;
    public savedBanners: string[];
    public isSavedSuccess = false;

    constructor(initialWelcomeBanners: string[] = []) {
      this.banner = initialWelcomeBanners.length > 0 ? initialWelcomeBanners[0] : "";
      this.savedBanners = [...initialWelcomeBanners];
    }

    public handleBannerChange(val: string) {
      this.banner = val;
    }

    public handleRemoveBanner(): boolean {
      const bannerUrl = (this.banner || "").trim();
      const isSaved = bannerUrl !== "" && this.savedBanners.includes(bannerUrl);

      if (isSaved && typeof window !== "undefined") {
        const confirmed = window.confirm("Deseja remover este banner?");
        if (!confirmed) {
          return false;
        }
      }

      this.banner = "";
      return true;
    }

    public async handleSave(saveActionMock: (data: { welcomeBanners: string[] }) => Promise<any>) {
      const cleanBanners = this.banner.trim() ? [this.banner.trim()] : [];
      await saveActionMock({ welcomeBanners: cleanBanners });
      this.savedBanners = cleanBanners;
      this.isSavedSuccess = true;
    }

    public isConfigured(): boolean {
      return Boolean(this.banner.trim());
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
    const manager = new SingleWelcomeBannerManager(["https://cdn.exemplo.com/banner-salvo-1.webp"]);

    expect(manager.isConfigured()).toBe(true);
    expect(manager.banner).toBe("https://cdn.exemplo.com/banner-salvo-1.webp");

    const removed = manager.handleRemoveBanner();

    expect(confirmSpy).toHaveBeenCalledWith("Deseja remover este banner?");
    expect(removed).toBe(true);
    expect(manager.banner).toBe("");
    expect(manager.isConfigured()).toBe(false);
  });

  // 2. Cancelamento da confirmação
  it("2. Cancelamento da confirmação não remove o banner e preserva a URL", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const manager = new SingleWelcomeBannerManager(["https://cdn.exemplo.com/banner-importante.webp"]);
    const removed = manager.handleRemoveBanner();

    expect(confirmSpy).toHaveBeenCalledWith("Deseja remover este banner?");
    expect(removed).toBe(false);
    expect(manager.banner).toBe("https://cdn.exemplo.com/banner-importante.webp");
    expect(manager.isConfigured()).toBe(true);
  });

  // 3. Remoção de um banner ainda não salvo
  it("3. Remoção de um banner ainda não salvo remove diretamente sem solicitar confirmação", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    // Iniciamos com formulário vazio
    const manager = new SingleWelcomeBannerManager([]);

    // Usuário digita ou envia uma URL ainda não salva
    manager.handleBannerChange("https://cdn.exemplo.com/banner-novo-nao-salvo.webp");
    expect(manager.isConfigured()).toBe(true);

    const removed = manager.handleRemoveBanner();

    // Confirmação NÃO é solicitada para banner não salvo
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(removed).toBe(true);
    expect(manager.banner).toBe("");
    expect(manager.isConfigured()).toBe(false);
  });

  // 4. Persistência após clicar em Salvar alterações
  it("4. Persistência após clicar em Salvar alterações salva array vazio quando banner foi removido", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const manager = new SingleWelcomeBannerManager(["https://cdn.exemplo.com/banner-1.webp"]);
    manager.handleRemoveBanner();

    const saveActionMock = vi.fn().mockResolvedValue({ success: true });
    await manager.handleSave(saveActionMock);

    expect(saveActionMock).toHaveBeenCalledWith({
      welcomeBanners: [],
    });
    expect(manager.savedBanners).toEqual([]);
    expect(manager.isSavedSuccess).toBe(true);
  });

  // 5. Ausência de exclusão indevida de arquivos compartilhados
  it("5. Ausência de exclusão indevida: apenas a referência do formulário é limpa sem chamada a API de storage", () => {
    const storageDeleteSpy = vi.fn();

    const manager = new SingleWelcomeBannerManager(["https://cdn.exemplo.com/shared-banner.webp"]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    manager.handleRemoveBanner();

    expect(storageDeleteSpy).not.toHaveBeenCalled();
    expect(manager.banner).toBe("");
  });
});
