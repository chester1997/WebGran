# Fluxo de Assinatura WebGran SaaS & Integração Banco Cora

Este documento detalha o fluxo de cobrança de assinatura de R$ 89,90/mês para os vendedores da plataforma WebGran SaaS utilizando a **Integração Direta mTLS com a API do Banco Cora**.

---

## 1. Visão Geral da Arquitetura

```
+------------------+         mTLS / OAuth2 Token          +------------------+
|                  | -----------------------------------> |                  |
|  WebGran Server  |  POST /token (Client Credentials)    |  Banco Cora API  |
|                  | <----------------------------------- |                  |
+------------------+         access_token (JWT)           +------------------+
         |                                                         |
         |                   POST /v2/invoices                     |
         | ------------------------------------------------------> |
         |                  (emv, pix.qr_code)                     |
         | <------------------------------------------------------ |
         |                                                         |
         v                                                         v
+------------------+                                      +------------------+
|  Vendedor UI     | <============== PIX EMV =============== |  App Bancário    |
|  (Expira 10min)  |                                      |  (Leitura QRCD)  |
+------------------+                                      +------------------+
```

---

## 2. Autenticação mTLS & Credenciais

### Credenciais Necessárias:
- `cora_client_id`: Identificador da API Cora.
- `cora_cert_pem`: Conteúdo completo do certificado digital público (`.pem`).
- `cora_key_pem`: Conteúdo completo da chave privada (`.key`).
- `cora_environment`: `production` (`https://matls-clients.api.cora.com.br/token`) ou `stage` (`https://matls-clients.stage.cora.com.br/token`).

### Segurança:
- **Segredo Total**: As chaves privadas e certificados **nunca** são transmitidos para o navegador/frontend.
- Toda requisição mTLS é realizada estritamente pelo servidor Node.js via `https.request`.
- Os tokens `access_token` gerados pela Cora possuem tempo de vida e são mantidos exclusivamente em memória no servidor durante as chamadas.

---

## 3. Emissão de Cobrança (Invoice / Pix Copia e Cola)

### Endpoint da Cora:
- **Produção**: `POST https://api.cora.com.br/v2/invoices`
- **Staging**: `POST https://api.stage.cora.com.br/v2/invoices`

### Payload Enviado à Cora:
```json
{
  "code": "inv_wg_1789955175022_a1b2",
  "customer": {
    "name": "Nome do Vendedor",
    "email": "vendedor@email.com",
    "document": {
      "identity": "12345678900",
      "type": "CPF"
    }
  },
  "services": [
    {
      "name": "Assinatura WebGran SaaS - R$ 89,90/mês",
      "amount": 8990
    }
  ],
  "payment_terms": {
    "due_date": "2026-09-23"
  },
  "payment_forms": ["PIX"]
}
```

### Resposta e Extração do EMV:
A Cora retorna a invoice com o objeto `pix.emv` (Pix Copia e Cola oficial com CRC checksum válido). O WebGran armazena o `pix.emv` e gera a imagem do QR Code via URL codificada `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=...`.

> **Zero Mock Guarantee**: Nenhum payload Pix fake (`00020101...`) é gerado localmente. Apenas o código `pix.emv` real emitido pela Cora é exibido e copiado pelo usuário.

---

## 4. Regra de Expiração de 10 Minutos (Server-Side)

### Funcionamento:
1. No momento da criação da cobrança:
   - `createdAt = now()`
   - `expiresAt = now() + 10 minutos`
2. No Banco de Dados (`invoices`):
   - Registrado com `status = 'PENDING'` e a data exata de `expiresAt`.
3. No Frontend:
   - O contador regressivo (`Expira em: 09:59`) calcula o tempo restante a partir de `expiresAt - Date.now()`.
   - Recarregar a página recalcula dinamicamente a partir de `expiresAt` retornado pelo servidor.
4. Quando o tempo atinge `00:00` ou `now >= expiresAt`:
   - O servidor consulta a API da Cora `GET /v2/invoices/{invoice_id}`.
   - Se a cobrança **não** estiver paga:
     - Cancela a invoice na Cora via `DELETE /v2/invoices/{invoice_id}`.
     - Marca o status interno como `EXPIRED`.
     - A interface substitui o QR Code pela tela de **Pagamento Expirado** com o botão `[ GERAR NOVO PIX ]`.

---

## 5. Geração de Novo PIX (`forceNew`)

Quando o vendedor clica em `[ GERAR NOVO PIX ]`:
- O frontend envia uma requisição `POST /api/billing/subscription` com `{ forceNew: true }`.
- O backend **não** reutiliza a cobrança anterior expirada.
- Uma **nova** invoice é criada no Banco Cora com novo `invoiceId`, novo `pix.emv` e nova validade de 10 minutos.

---

## 6. Verificação & Polling de Pagamento

### Botão "Já paguei":
- O botão aciona `POST /api/billing/subscription/verify`.
- O servidor faz chamada real `GET /v2/invoices/{invoice_id}` na API do Banco Cora via mTLS.
- **Pagamento Confirmado (`PAID`)**:
  - Atualiza status da invoice para `PAID` com `paidAt = now()`.
  - Atualiza o status da assinatura do vendedor para `ACTIVE` e estende a cobrança por **30 dias**.
- **Pagamento Pendente (`OPEN`)**:
  - Notifica o vendedor que o pagamento ainda está sendo processado pela Cora.

### Webhook Automático:
- Endpoint: `POST /api/billing/cora/webhook`
- O webhook processa eventos `invoice.paid` da Cora de forma **idempotente** (não duplica períodos de assinatura se reenviado).

---

## 7. Diagnósticos para o Administrador

No painel de controle do Admin (`/admin/settings`), a seção de credenciais Cora exibe:
- **Status da Conexão**: Conectada / Desconectada (validada via mTLS real no endpoint de token).
- **Ambiente Ativo**: Produção / Staging.
- **Última Validação**: Data/Hora da chamada mTLS realizada.
- **Última Invoice**: ID e status da cobrança de assinatura mais recente emitida no sistema.
