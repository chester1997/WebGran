# Documentação de Integração: Telegram API

Esta documentação descreve a arquitetura da comunicação entre o WebGran e a API do Telegram, garantindo as melhores práticas de segurança e escalabilidade.

## Estrutura de Diretórios (`src/lib/telegram/`)

A integração foi isolada em uma camada de serviço (Server-Side) para evitar a exposição do token do bot no frontend.

* **`types.ts`**: Tipagens genéricas para os payloads da API do Telegram (ex: `TelegramResponse`, `TelegramUser`).
* **`validation.ts`**: Classes customizadas de tratamento de erro (`TelegramError`, `TelegramInvalidTokenError`, `TelegramUnavailableError`) para respostas unificadas e tratamento seguro no Client.
* **`client.ts`**: Wrapper HTTP interno (`telegramFetch`) que anexa o token e faz o handle das respostas nativas (401, 404, etc).
* **`bot.ts`**: Abstração Orientada a Objetos (`TelegramBotService`). Exposição de métodos seguros (`getMe`, `setWebhook`, `sendMessage`, etc).

## Fluxo de Autenticação de Bots (Seller Panel)

1. O vendedor digita o token fornecido pelo `@BotFather` no painel "Meu Bot".
2. A _Server Action_ `connectTelegramBot` invoca a instância `TelegramBotService`.
3. O serviço se comunica com a rota `/getMe`.
4. Se validado:
   * Verifica se o `botId` já está sendo utilizado por outra loja no ecossistema WebGran (evitando sequestro de bots).
   * O Token é encriptado via módulo `crypto` utilizando o algoritmo `AES-256-CBC` (Implementado em `src/lib/encryption.ts`).
   * Configura-se imediatamente o Webhook (`/setWebhook`) apontando para `/api/telegram/webhook` do WebGran.
   * Os dados oficiais (`id`, `username`, `first_name`) são armazenados de forma associativa ao banco.

## Diretrizes de Segurança Obrigatórias

* **NUNCA** armazene tokens do Telegram em formato texto puro no banco de dados.
* **NUNCA** retorne o token para o Frontend (as ações do Next.js lidam com o objeto do Banco sem enviar o token encriptado de volta ao cliente).
* **NUNCA** faça chamadas `fetch('https://api.telegram.org/bot...')` diretamente de Client Components ou exposto no navegador.
* **NUNCA** inclua tokens (`.env`) em repositórios Git, commits ou logs dinâmicos.

## Tratamento de Erros

O serviço emite exceções mapeadas nativamente que devem ser tratadas pelo `try/catch` na Server Action:

* `TelegramInvalidTokenError` (401/404): Retorna "Token inválido ou bot não encontrado".
* `TelegramUnavailableError` (503): Disparado por falhas de conectividade ou indisponibilidade da própria API do Telegram.
