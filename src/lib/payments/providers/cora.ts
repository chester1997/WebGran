import https from 'https';
import { 
  PlatformBillingProvider, 
  CreateInvoiceParams, 
  InvoiceResponse 
} from '../types';

export interface CoraConfig {
  clientId?: string;
  certPem?: string;
  keyPem?: string;
  environment?: 'stage' | 'production';
}

function sanitizeLogMessage(data: any): string {
  if (typeof data === 'string') {
    return data
      .replace(/client_secret=[^&]+/gi, 'client_secret=***')
      .replace(/access_token=[^&]+/gi, 'access_token=***')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***');
  }
  return JSON.stringify(data);
}

function executeMTLSRequest(
  urlStr: string, 
  options: { 
    method: string; 
    headers?: Record<string, string>; 
    cert?: string; 
    key?: string; 
    body?: string;
  }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const reqOptions: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        cert: options.cert,
        key: options.key,
        rejectUnauthorized: true,
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
      });

      req.on('error', (err) => reject(err));

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export class CoraProvider implements PlatformBillingProvider {
  private config: CoraConfig;

  constructor(config?: CoraConfig) {
    this.config = {
      clientId: config?.clientId || process.env.CORA_CLIENT_ID,
      certPem: config?.certPem || process.env.CORA_CERT_PEM,
      keyPem: config?.keyPem || process.env.CORA_KEY_PEM,
      environment: (process.env.CORA_ENV as 'stage' | 'production') || 'production'
    };
  }

  public async getActiveConfig(): Promise<CoraConfig> {
    try {
      const { db } = await import('@/db');
      const { systemSettings } = await import('@/db/schema');
      const { inArray } = await import('drizzle-orm');

      const settings = await db.query.systemSettings.findMany({
        where: inArray(systemSettings.key, [
          'cora_client_id', 
          'cora_cert_pem', 
          'cora_key_pem', 
          'cora_environment'
        ])
      });

      const settingsMap = new Map(settings.map(s => [s.key, s.value]));

      return {
        clientId: settingsMap.get('cora_client_id') || this.config.clientId || process.env.CORA_CLIENT_ID,
        certPem: settingsMap.get('cora_cert_pem') || this.config.certPem || process.env.CORA_CERT_PEM,
        keyPem: settingsMap.get('cora_key_pem') || this.config.keyPem || process.env.CORA_KEY_PEM,
        environment: (settingsMap.get('cora_environment') as 'stage' | 'production') || this.config.environment || 'production'
      };
    } catch {
      return {
        clientId: this.config.clientId || process.env.CORA_CLIENT_ID,
        certPem: this.config.certPem || process.env.CORA_CERT_PEM,
        keyPem: this.config.keyPem || process.env.CORA_KEY_PEM,
        environment: (process.env.CORA_ENV as 'stage' | 'production') || this.config.environment || 'production'
      };
    }
  }

  /**
   * Authenticate with Cora mTLS Token Endpoint
   */
  async authenticate(config: CoraConfig): Promise<{ accessToken: string; expiresIn: number }> {
    if (!config.clientId || !config.certPem || !config.keyPem) {
      throw new Error('Credenciais da Integração Direta Cora incompletas (Client ID, Certificado .pem e Chave Privada .key são obrigatórios).');
    }

    const tokenUrl = config.environment === 'stage'
      ? 'https://matls-clients.stage.cora.com.br/token'
      : 'https://matls-clients.api.cora.com.br/token';

    const requestBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId.trim()
    }).toString();

    const response = await executeMTLSRequest(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(requestBody).toString()
      },
      cert: config.certPem,
      key: config.keyPem,
      body: requestBody
    });

    if (response.status < 200 || response.status >= 300) {
      let errorMsg = `Erro ${response.status} na autenticação mTLS da Cora.`;
      try {
        const errJson = JSON.parse(response.body);
        errorMsg = errJson.error_description || errJson.message || errJson.error || errorMsg;
      } catch {}
      console.error(`[CORA AUTH ERROR] HTTP ${response.status}: ${sanitizeLogMessage(errorMsg)}`);
      throw new Error(errorMsg);
    }

    const json = JSON.parse(response.body);
    if (!json.access_token) {
      throw new Error('Resposta da Cora não incluiu access_token.');
    }

    return {
      accessToken: json.access_token,
      expiresIn: json.expires_in || 3600
    };
  }

  /**
   * Create a REAL PIX Billed Invoice via Cora Direct Integration API
   * NO FAKE MOCK FALLBACKS ALLOWED.
   */
  async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse> {
    const activeConfig = await this.getActiveConfig();

    if (!activeConfig.clientId || !activeConfig.certPem || !activeConfig.keyPem) {
      throw new Error('Conta Cora não configurada. Insira as credenciais reais no Painel Admin.');
    }

    const { accessToken } = await this.authenticate(activeConfig);

    const invoicesUrl = activeConfig.environment === 'stage'
      ? 'https://api.stage.cora.com.br/v2/invoices'
      : 'https://api.cora.com.br/v2/invoices';

    // Amount in centavos (e.g. R$ 89.90 -> 8990)
    const amountInCents = Math.round(params.amount * 100);
    const invoiceCode = `inv_wg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Prepare customer object with document if available
    const docClean = (params.customerDocument || '00000000000').replace(/\D/g, '');
    const docType = params.documentType || (docClean.length > 11 ? 'CNPJ' : 'CPF');

    const requestPayload = {
      code: invoiceCode,
      customer: {
        name: params.customerName || 'Vendedor WebGran',
        email: params.customerEmail || 'vendedor@webgran.online',
        document: {
          identity: docClean.length >= 11 ? docClean : '00000000000',
          type: docType
        }
      },
      services: [
        {
          name: `Assinatura WebGran SaaS - R$ ${params.amount.toFixed(2).replace('.', ',')}/mês`,
          amount: amountInCents
        }
      ],
      payment_terms: {
        due_date: params.dueDate.toISOString().split('T')[0]
      },
      payment_forms: ['PIX']
    };

    const requestBody = JSON.stringify(requestPayload);

    const invoiceRes = await executeMTLSRequest(invoicesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody).toString()
      },
      cert: activeConfig.certPem,
      key: activeConfig.keyPem,
      body: requestBody
    });

    if (invoiceRes.status < 200 || invoiceRes.status >= 300) {
      let errDetail = invoiceRes.body;
      try {
        const errObj = JSON.parse(invoiceRes.body);
        errDetail = errObj.message || errObj.error || JSON.stringify(errObj);
      } catch {}

      console.error(`[CORA INVOICE CREATION FAIL] HTTP ${invoiceRes.status} | Endpoint: ${invoicesUrl} | Error: ${sanitizeLogMessage(errDetail)}`);
      throw new Error(`Erro ao emitir cobrança no Banco Cora (HTTP ${invoiceRes.status}): ${errDetail}`);
    }

    const data = JSON.parse(invoiceRes.body);

    // Extract REAL EMV Pix Copia e Cola from Cora response
    const coraEmv = data.pix?.emv || data.pix?.qr_code || data.payment_options?.pix?.emv || data.emv;

    if (!coraEmv) {
      console.error(`[CORA INVOICE ERROR] Response received HTTP 200/201 but no pix.emv present. ID: ${data.id}`);
      throw new Error('A Cora criou a cobrança mas não retornou o código Pix Copia e Cola (pix.emv).');
    }

    const coraInvoiceId = data.id || invoiceCode;
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(coraEmv)}`;

    console.log(`[CORA INVOICE SUCCESS] HTTP ${invoiceRes.status} | ID: ${coraInvoiceId} | Status: ${data.status} | EMV Length: ${coraEmv.length}`);

    return {
      id: coraInvoiceId,
      status: 'PENDING',
      qrCode: qrCodeImageUrl,
      qrCodeText: coraEmv
    };
  }

  /**
   * Fetch invoice status from Cora API via GET /v2/invoices/{id}
   */
  async getInvoice(invoiceId: string): Promise<InvoiceResponse> {
    const activeConfig = await this.getActiveConfig();

    if (!activeConfig.clientId || !activeConfig.certPem || !activeConfig.keyPem) {
      throw new Error('Credenciais Cora ausentes para consulta.');
    }

    const { accessToken } = await this.authenticate(activeConfig);

    const invoicesUrl = activeConfig.environment === 'stage'
      ? `https://api.stage.cora.com.br/v2/invoices/${invoiceId}`
      : `https://api.cora.com.br/v2/invoices/${invoiceId}`;

    const res = await executeMTLSRequest(invoicesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      cert: activeConfig.certPem,
      key: activeConfig.keyPem
    });

    if (res.status < 200 || res.status >= 300) {
      console.error(`[CORA GET INVOICE FAIL] HTTP ${res.status} | ID: ${invoiceId}`);
      throw new Error(`Erro ao consultar invoice ${invoiceId} na Cora (HTTP ${res.status}).`);
    }

    const data = JSON.parse(res.body);
    const coraStatus = (data.status || '').toUpperCase();

    let mappedStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' = 'PENDING';
    if (coraStatus === 'PAID' || coraStatus === 'SETTLED' || coraStatus === 'COMPLETED') {
      mappedStatus = 'PAID';
    } else if (coraStatus === 'CANCELLED' || coraStatus === 'VOID') {
      mappedStatus = 'CANCELLED';
    } else if (coraStatus === 'LATE' || coraStatus === 'EXPIRED') {
      mappedStatus = 'EXPIRED';
    }

    const coraEmv = data.pix?.emv || data.pix?.qr_code || data.payment_options?.pix?.emv || data.emv;
    const qrCodeImageUrl = coraEmv ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(coraEmv)}` : undefined;

    return {
      id: data.id || invoiceId,
      status: mappedStatus,
      qrCode: qrCodeImageUrl,
      qrCodeText: coraEmv || undefined
    };
  }

  /**
   * Cancel an unpaid invoice on Cora API via DELETE /v2/invoices/{id}
   */
  async cancelInvoice(invoiceId: string): Promise<void> {
    try {
      const activeConfig = await this.getActiveConfig();
      if (!activeConfig.clientId || !activeConfig.certPem || !activeConfig.keyPem) {
        return;
      }

      const { accessToken } = await this.authenticate(activeConfig);

      const cancelUrl = activeConfig.environment === 'stage'
        ? `https://api.stage.cora.com.br/v2/invoices/${invoiceId}`
        : `https://api.cora.com.br/v2/invoices/${invoiceId}`;

      const res = await executeMTLSRequest(cancelUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        cert: activeConfig.certPem,
        key: activeConfig.keyPem
      });

      console.log(`[CORA CANCEL INVOICE] ID: ${invoiceId} | HTTP Status: ${res.status}`);
    } catch (err) {
      console.error(`[CORA CANCEL INVOICE ERROR] Failed to cancel ${invoiceId}:`, err);
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    // Handled in dedicated webhook route
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<string> {
    return 'ACTIVE';
  }
}

export const coraProvider = new CoraProvider();
