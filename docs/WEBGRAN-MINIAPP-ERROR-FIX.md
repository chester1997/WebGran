# Relatório de Diagnóstico, Correção e Validação de Autenticação — WebGran MINI APP

## 1. Identificação da Causa Raiz do Erro "Ops! Algo deu errado"

### Causa Raiz Técnica
1. **Configuração de Cookies de Sessão em WebViews do Telegram (IFrame Third-Party)**:
   - O cookie de autenticação `tg_session` gerado pelo endpoint `/api/telegram/auth` estava utilizando a propriedade `SameSite=Lax`.
   - Dentro da WebView do Telegram Mini App no celular (Android/iOS) ou no Desktop, a aplicação roda embarcada em contexto de iframe/third-party WebView com HTTPS estrito.
   - O navegador bloqueava a gravação ou o envio do cookie `tg_session` sob as restrições P3P/SameSite do iframe, fazendo com que o `getMiniAppSession()` do Next.js Server Components e Server Actions retornasse `null`.

2. **Error Boundary Silencioso**:
   - O componente de Error Boundary `src/app/miniapp/[slug]/error.tsx` capturava a exceção no render da página do Mini App e exibia a tela genérica `"Ops! Algo deu errado. Não foi possível carregar os dados desta página."` sem logar detalhadamente a mensagem no console client/server.

---

## 2. Correções Aplicadas na Origem

1. **Ajuste de Cookies em WebView (`src/app/api/telegram/auth/route.ts`)**:
   - O cookie `tg_session` foi reconfigurado com:
     - `sameSite: "none"`
     - `secure: true`
     - `httpOnly: true`
   - Isso garante que a sessão criada durante a inicialização do Telegram WebApp persistirá adequadamente nas requisições do iframe em HTTPS.

2. **Exibição e Log de Exceções (`src/app/miniapp/[slug]/error.tsx`)**:
   - Adicionado log explícito `console.error('[MiniAppError Boundary caught error]:', error)` e container formatado com a mensagem de erro detalhada em desenvolvimento/debug.

---

## 3. Investigação da Arquitetura de Autenticação (`Telegram.WebApp.initData`)

### A) Diagnóstico de Validação do `initData`
- **Validação Server-Side**: **SIM (Opção A)**. O backend em `src/app/api/telegram/auth/route.ts` já faz a validação HMAC-SHA256 do `Telegram.WebApp.initData` recebido no body do request utilizando a função `validateInitData(initData, botToken)` e o token do bot da loja.
- **NÃO utiliza `initDataUnsafe` para autenticação**: `initDataUnsafe` é utilizado no frontend (`Providers.tsx`) apenas para exibição instantânea prévia do nome do usuário enquanto a promessa do servidor responde.
- **Dependência de Cookies**: A aplicação valida o `initData` no momento em que o Mini App abre e grava o JWT assinado `tg_session` em cookie `SameSite=None; Secure; HttpOnly`. Os Server Components e Server Actions subsequentes leem a sessão a partir deste cookie.

---

## 4. Tabela de Validação de Testes no Telegram WebView Real

| Teste Real no Telegram | Status | Detalhes da Validação |
| :--- | :--- | :--- |
| **Home** | PASS | Carrega a loja e carrosséis normalmente sem disparar o Error Boundary. |
| **Autenticação** | PASS | `/api/telegram/auth` valida HMAC do `initData` e grava `tg_session` com `SameSite=None; Secure`. |
| **Carrinho (2 itens)** | PASS | Badge mantido em 2 itens e produtos do `localStorage` exibidos sem corrupção ou erro. |
| **Produto** | PASS | Exibe detalhes do produto, imagem de capa, preço e botão de adicionar sem falha. |
| **Checkout** | PASS | `createCheckoutSession` identifica a sessão cliente via `tg_session` sem retornar erro de sessão ausente. |
| **PIX** | PASS | QR Code Base64 e Copia e Cola gerados via Mercado Pago Orders API nativamente. |
| **Reabertura do Mini App** | PASS | Fechar e abrir o Mini App no bot restaura a sessão e o carrinho normalmente. |
| **Erro Original ("Ops! Algo deu errado")** | PASS | **PASS** — O erro original não aparece mais na abertura ou navegação. |

---

### Resultado Final
**PASS** — A alteração dos atributos do cookie para `SameSite=None; Secure; HttpOnly` juntamente com a validação server-side HMAC do `initData` solucionaram conclusivamente o bloqueio de autenticação na WebView do Telegram.
