import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectTelegramBot } from '@/app/(seller)/seller/bot/actions';
import { TelegramError } from '@/lib/telegram/validation';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((token) => `encrypted_${token}`),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/telegram/bot', () => {
  return {
    TelegramBotService: class {
      token: string;
      constructor(token: string) {
        this.token = token;
      }
      async getMe() {
        if (this.token === 'invalid_token') {
          throw new TelegramError('Token inválido ou revogado.', 401);
        }
        return {
          id: 123456789,
          is_bot: true,
          first_name: 'TestBot',
          username: 'test_bot',
        };
      }
      async getMyDescription() {
        return { description: 'Bot description' };
      }
      async setWebhook() {
        return true;
      }
    }
  };
});

const mockDb = vi.hoisted(() => {
  return {
    query: {
      telegramBots: { findFirst: vi.fn() },
      themes: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() }
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'new_store_id' }]))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(true))
      }))
    })),
  };
});

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  ne: vi.fn(),
  relations: vi.fn(),
}));
import { requireSeller } from '@/lib/auth';

describe('connectTelegramBot Action', () => {
  const mockUser = { id: 'seller_1' };

  beforeEach(() => {
    vi.resetAllMocks();
    (requireSeller as any).mockResolvedValue(mockUser);
    
    // Default mocks
    mockDb.query.themes.findFirst.mockResolvedValue({ id: 'theme_studio_1', name: 'Studio' });
  });

  it('deve retornar erro para token inválido', async () => {
    const formData = new FormData();
    formData.append('token', 'invalid_token');

    const result = await connectTelegramBot(null, formData);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Token inválido ou revogado.');
  });

  it('deve criar loja automaticamente para um bot novo', async () => {
    const formData = new FormData();
    formData.append('token', 'valid_token_new');

    mockDb.query.telegramBots.findFirst.mockResolvedValue(null);
    mockDb.query.stores.findFirst.mockResolvedValue(null);

    const result = await connectTelegramBot(null, formData);

    if (!result.success) console.error(result.error);
    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalledTimes(2); 
  });

  it('deve vincular a loja existente se o bot for novo mas o vendedor já tiver loja', async () => {
    const formData = new FormData();
    formData.append('token', 'valid_token_existing_store');

    mockDb.query.telegramBots.findFirst.mockResolvedValue(null);
    mockDb.query.stores.findFirst.mockResolvedValue({ id: 'existing_store_1', ownerId: 'seller_1', description: '' });

    const result = await connectTelegramBot(null, formData);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled(); 
    expect(mockDb.insert).toHaveBeenCalledTimes(1); 
  });

  it('deve atualizar o bot e loja se o bot for existente e do mesmo vendedor', async () => {
    const formData = new FormData();
    formData.append('token', 'valid_token_existing_bot');

    const existingBot = {
      id: 'bot_1',
      botId: '123456789',
      storeId: 'store_1',
      store: { ownerId: 'seller_1' }
    };

    mockDb.query.telegramBots.findFirst.mockResolvedValue(existingBot);

    const result = await connectTelegramBot(null, formData);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalledTimes(1); // Only for telegramBots when it already exists
  });

  it('deve impedir a conexão se o bot pertencer a outro vendedor', async () => {
    const formData = new FormData();
    formData.append('token', 'valid_token_stolen');

    const existingBot = {
      id: 'bot_1',
      botId: '123456789',
      storeId: 'store_2',
      store: { ownerId: 'other_seller' }
    };

    mockDb.query.telegramBots.findFirst.mockResolvedValue(existingBot);

    const result = await connectTelegramBot(null, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Este bot já está conectado a outra loja no WebGran.');
  });
});
