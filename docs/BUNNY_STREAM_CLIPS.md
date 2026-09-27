# Documentação de Infraestrutura: Bunny Stream + Clips (Fase 1)

## 1. Visão Geral
A infraestrutura de vídeo do recurso **Clips** do WebGran foi integrada utilizando o **Bunny Stream** para armazenamento, transcoding e distribuição via CDN de vídeos verticais, mantendo os metadados e controle multi-tenant gravados no banco de dados **Neon (PostgreSQL)** através do ORM **Drizzle**.

## 2. Variáveis de Ambiente (Server-Side Only)

As seguintes variáveis de ambiente são **estritamente server-side** e nunca são expostas ao browser / client-side:

```env
BUNNY_STREAM_LIBRARY_ID="763931"
BUNNY_STREAM_API_KEY="[SECRET]"
BUNNY_STREAM_CDN_HOSTNAME="vz-73b50578-eab.b-cdn.net"
BUNNY_STREAM_WEBHOOK_SECRET="[OPCIONAL_SECRET_WEBHOOK]"
```

> **Atenção:** Nenhuma credencial `BUNNY_STREAM_API_KEY` deve possuir o prefixo `NEXT_PUBLIC_` ou ser retornada em respostas da API REST.

---

## 3. Modelo de Banco de Dados (`clips`)

A tabela `clips` no Neon possui o seguinte esquema:

- `id` (UUID, Primary Key)
- `storeId` (UUID, Foreign Key → `stores.id`)
- `title` (Text, Not Null)
- `description` (Text, Nullable)
- `bunnyVideoId` (Text, Not Null, Indexado)
- `thumbnailUrl` (Text, Nullable)
- `duration` (Integer em segundos, Nullable)
- `status` (Text, Enum: `'UPLOADING'` | `'PROCESSING'` | `'READY'` | `'FAILED'`)
- `position` (Integer, Default `0`, Indexado com `storeId`)
- `isActive` (Boolean, Default `true`)
- `createdAt` / `updatedAt` (Timestamp)

---

## 4. Endpoint do Webhook
- **URL de Produção:** `https://www.webgran.online/api/webhooks/bunny-stream`
- **Método HTTP:** `POST`
- **Comportamento:**
  - Valida autenticidade caso `BUNNY_STREAM_WEBHOOK_SECRET` esteja configurado.
  - Localiza o vídeo por `bunnyVideoId` e atualiza o estado para `'PROCESSING'`, `'READY'` ou `'FAILED'`.
  - É **idempotente** (não gera duplicações e responde `200 OK`).

---

## 5. Arquitetura de Upload Direto do Navegador (Fase 2)

Para evitar sobrecarregar os servidores da Vercel:

1. O vendedor solicita uma sessão de upload via `POST /api/seller/clips/upload-session`.
2. O servidor gera uma entrada no Neon (`status: 'UPLOADING'`) e cria uma **assinatura presigned de curta duração (SHA-256)** via `BunnyStreamService.generateDirectUploadSignature()`.
3. O navegador faz o upload do arquivo binário **diretamente para a API do Bunny Stream** (`https://video.bunnycdn.net/library/...`).
4. Ao concluir, o Bunny Stream notifica o endpoint `/api/webhooks/bunny-stream`, que transiciona o clipe para `'READY'`.

---

## 6. Serviços Server-Side
- [`src/lib/bunny/stream.ts`](file:///d:/TELEGRAM/WebGran/src/lib/bunny/stream.ts): `BunnyStreamService` (Criação de vídeos, consulta de metadados, presigned signatures e geração de URLs HLS/Thumbnail).
- [`src/lib/clips/service.ts`](file:///d:/TELEGRAM/WebGran/src/lib/clips/service.ts): `ClipService` (Operações de banco de dados com escopo estrito por `storeId`).
- [`src/app/api/webhooks/bunny-stream/route.ts`](file:///d:/TELEGRAM/WebGran/src/app/api/webhooks/bunny-stream/route.ts): Endpoint de Webhook do Bunny Stream.
- [`src/app/api/seller/clips/upload-session/route.ts`](file:///d:/TELEGRAM/WebGran/src/app/api/seller/clips/upload-session/route.ts): Rota autenticada do vendedor para autorização de upload.
