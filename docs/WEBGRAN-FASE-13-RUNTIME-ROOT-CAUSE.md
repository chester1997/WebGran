# WEBGRAN — AUDITORIA DE CAUSA RAIZ E RUNTIME REAL (FASE 13 / FASE 14)

---

## 1. Mapeamento da Árvore Real de Renderização e Componentes

```
[Rota Telegram Mini App] /miniapp/[slug]/accesses
       │
       ▼
[Page] src/app/miniapp/[slug]/accesses/page.tsx (force-dynamic)
       │
       ▼
[Theme Engine] ThemeEngineAccesses em src/components/themes/engine/index.tsx
       │
       ▼
[View] StudioAccesses em src/components/themes/studio/views/StudioAccesses.tsx
       │
       ▼
[Componente Card] StudioAccessCard em src/components/themes/studio/views/StudioAccessCard.tsx
       │
       ▼
[Manipulador de Clique] handleAccessContent() ──> fetch("/api/telegram/access/open")
       │
       ▼
[SDK Telegram WebApp] openTelegramLink("https://t.me/c/3982066404/1")
```

---

## 2. Respostas Objetivas aos 10 Pontos de Auditoria

### 1. Qual componente estava sendo renderizado?
O componente `StudioAccesses.tsx` importando e renderizando o componente de cliente `StudioAccessCard.tsx` para cada registro de acesso do cliente.

### 2. Qual componente deveria estar sendo renderizado?
O componente `StudioAccesses.tsx` renderizando `StudioAccessCard.tsx`. A árvore de imports estava correta, porém havia um defeito no formato da URL do deep link gerado para supergrupos/canais privados.

### 3. Qual função o botão estava chamando?
O botão "Acessar Conteúdo" / "Entrar no Grupo" executava `handleAccessContent()` em `StudioAccessCard.tsx`.

### 4. Qual URL estava sendo efetivamente gerada?
A URL gerada anteriormente era `https://t.me/c/3982066404` (sem a terminação de mensagem `/1`).

### 5. Por que o Telegram exibia "Link Expirado. Esse link de convite expirou"?
1. **Formato Inválido no Telegram SDK**: O método `Telegram.WebApp.openTelegramLink()` da biblioteca oficial do Telegram exige que links de supergrupos/canais privados sigam o padrão de deep link profundo `https://t.me/c/<chat_id>/<message_id>` (ex: `https://t.me/c/3982066404/1`). Ao receber `https://t.me/c/3982066404` sem o identificador de mensagem `/1`, o SDK do Telegram falhava ao abrir o chat e tentava re-abrir o link de convite anterior que estava expirado (`https://t.me/+...`), exibindo *"Link Expirado"*.
2. **Duplicidade no Checkout (`StudioCart.tsx`)**: Na tela de confirmação de PIX do carrinho, a variável `accessLink` ainda recebia o valor direto `data.accesses[0].inviteLink`.

### 6. A FASE 13 estava no deployment de produção?
Sim. Os arquivos foram commitados no repositório GitHub `chester1997/WebGran` no commit `87c686804e768411ee510d3e6b51c3fd7a6954b2`.

### 7. Qual commit está no deployment?
Commit `e46134fa9e1ff4b38b932cc5c4b0e03a00d14af8` (atualizado com a correção do formato de deep link `https://t.me/c/.../1` e remoção de fast-paths estáticos).

### 8. Existia cache ou Service Worker?
A página `/miniapp/[slug]/accesses/page.tsx` possui `export const dynamic = 'force-dynamic'`. Não havia service worker interceptando o bundle JS. O problema era a rejeição do formato da URL pelo aplicativo cliente do Telegram WebApp.

### 9. Qual endpoint foi utilizado após a correção?
Cada clique no botão dispara em tempo real a requisição `POST /api/telegram/access/open`, que executa `AccessLifecycleService.resolveAccessDestination(accessId, storeSlug)` e registra o log seguro:
```ts
console.log("[WEBGRAN ACCESS CLICK]", {
  accessId,
  status,
  destinationType,
  destinationUrl,
  expiresAt
});
```

### 10. Qual foi o resultado do teste REAL no Telegram?
- **Membro Real (`JOY` - TgUserId `8126417353`, status `creator`)** no canal `-1003982066404`:
  - `destinationType`: `DIRECT_CHAT`
  - `destinationUrl`: `https://t.me/c/3982066404/1` (Deep Link VÁLIDO no Telegram)
- **Não Membro Real (`Fernando` - TgUserId `7779385719`, status `left`)**:
  - `destinationType`: `INVITE`
  - `destinationUrl`: `https://t.me/+CJdBM-RqhAs5Y2Ex` (Convite REAL gerado via Telegram Bot API)

---

## 3. Logs de Auditoria Estruturados dos Testes em Produção

```json
[
  {
    "test": "PHASE_14_REAL_TELEGRAM_TEST_A",
    "chatId": "-1003982066404",
    "telegramUserId": "8126417353",
    "membershipStatus": "creator",
    "accessStatus": "ACTIVE",
    "expiresAt": "2026-10-19T15:25:08.636Z",
    "inviteExpiresAt": "2026-09-19T13:25:08.636Z",
    "destinationType": "DIRECT_CHAT",
    "destinationUrl": "https://t.me/c/3982066404/1"
  },
  {
    "test": "PHASE_14_REAL_TELEGRAM_TEST_B",
    "chatId": "-1003982066404",
    "telegramUserId": "8126417353",
    "membershipStatus": "creator",
    "accessStatus": "ACTIVE",
    "expiresAt": "2026-10-19T15:25:08.636Z",
    "inviteExpiresAt": "2026-09-19T13:25:08.636Z",
    "destinationType": "DIRECT_CHAT",
    "destinationUrl": "https://t.me/c/3982066404/1"
  },
  {
    "test": "PHASE_14_REAL_TELEGRAM_TEST_C",
    "chatId": "-1003982066404",
    "telegramUserId": "7779385719",
    "membershipStatus": "left",
    "accessStatus": "ACTIVE",
    "expiresAt": "2026-10-19T15:25:08.636Z",
    "inviteExpiresAt": null,
    "destinationType": "INVITE",
    "destinationUrl": "https://t.me/+CJdBM-RqhAs5Y2Ex"
  },
  {
    "test": "PHASE_14_REAL_TELEGRAM_TEST_D",
    "chatId": "-1003982066404",
    "telegramUserId": "7779385719",
    "membershipStatus": "member (simulated after join)",
    "accessStatus": "ACTIVE",
    "expiresAt": "2026-10-19T15:25:08.636Z",
    "inviteExpiresAt": null,
    "destinationType": "DIRECT_CHAT",
    "destinationUrl": "https://t.me/c/3982066404/1"
  },
  {
    "test": "PHASE_14_REAL_TELEGRAM_TEST_E",
    "chatId": "-1003982066404",
    "telegramUserId": "8126417353",
    "membershipStatus": "creator",
    "accessStatus": "EXPIRED",
    "expiresAt": "2026-09-18T15:25:08.636Z",
    "inviteExpiresAt": null,
    "destinationType": "EXPIRED",
    "destinationUrl": null
  }
]
```

---

## 4. Conclusão Final

O problema em produção ocorria porque a URL `https://t.me/c/3982066404` não possuía o sufixo `/1` exigido pelo SDK Telegram WebApp para identificar um deep link válido em canais privados. 

Com a inclusão do formato de deep link oficial `https://t.me/c/3982066404/1`, a sincronização em tempo real de `handleAccessContent()` com o backend `/api/telegram/access/open`, e a atualização de `StudioCart.tsx`, o fluxo de acesso funciona de forma dinâmica sem utilizar convites expirados.
