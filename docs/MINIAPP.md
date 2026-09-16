# Telegram Mini App Architecture

A seção do Mini App é projetada para rodar exclusivamente no Telegram WebView, oferecendo uma experiência nativa para os clientes finais.

## Rotas
A base do Mini App fica em `/miniapp/[slug]`. 
O `slug` identifica unicamente a loja. Isso permite o ecossistema SaaS Multi-tenant.

## Autenticação

A Autenticação via Mini App não usa credenciais tradicionais. O fluxo ocorre assim:

1. O script nativo do Telegram (`telegram-web-app.js`) é injetado via `Script` component do Next.js.
2. A aplicação coleta `window.Telegram.WebApp.initData`.
3. O frontend envia isso ao endpoint interno `POST /api/telegram/auth`.
4. O backend recupera a chave criptográfica do bot correspondente a loja.
5. Um HmacSHA256 (`WebAppData`) duplo valida a veracidade da assinatura (previne spoofing de `initDataUnsafe`).
6. O Customer do Telegram é registrado ou atualizado.
7. Uma assinatura JWT (via `jose`) é retornada com validade de 7 dias, ou até a expiração natural da sessão do WebView.

## Tema e Variáveis Visuais

O Mini App é projetado para herdar automaticamente as preferências (Light/Dark Mode e paleta de cores) configuradas no cliente do Telegram do usuário. As cores são aplicadas dinamicamente injetando as variáveis no `documentElement`, conforme fornecido pelo objeto `window.Telegram.WebApp.themeParams`:

* `--tg-theme-bg-color`
* `--tg-theme-text-color`
* `--tg-theme-hint-color`
* `--tg-theme-link-color`
* `--tg-theme-button-color`
* `--tg-theme-button-text-color`

Componentes internos do Mini App devem **sempre** utilizar essas variáveis no atributo `style` (ou mapeadas no tailwind.config) para respeitar o layout nativo.
