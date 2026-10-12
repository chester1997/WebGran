/**
 * Support Helper Utility for WebGran Mini App
 * Handles validation, normalization, link generation, and safe opening
 * for Telegram, WhatsApp, and External Link support configurations.
 */

export type SupportType = "telegram" | "whatsapp" | "link";

export interface SupportConfigResult {
  isValid: boolean;
  type: SupportType | null;
  rawInput: string;
  normalizedValue: string;
  url: string | null;
  openType: "telegram" | "external" | null;
  errorMessage?: string;
}

const TELEGRAM_USERNAME_REGEX = /^[a-zA-Z0-9_]{5,32}$/;

/**
 * Validates and normalizes a Telegram username.
 * Supports @username, username, or t.me/username URLs.
 */
export function validateAndNormalizeTelegram(value: string): {
  isValid: boolean;
  cleanUsername: string;
  url: string | null;
  errorMessage?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      isValid: false,
      cleanUsername: "",
      url: null,
      errorMessage: "Informe o username do Telegram.",
    };
  }

  // Strip prefixes like https://t.me/, http://t.me/, t.me/, or leading @
  let clean = trimmed
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .replace(/^@+/, "")
    .replace(/\/+$/, "")
    .trim();

  // Remove any query params or hash if pasted from URL
  if (clean.includes("?")) clean = clean.split("?")[0];
  if (clean.includes("#")) clean = clean.split("#")[0];

  if (!clean) {
    return {
      isValid: false,
      cleanUsername: "",
      url: null,
      errorMessage: "Username do Telegram vazio.",
    };
  }

  if (clean.length < 5 || clean.length > 32) {
    return {
      isValid: false,
      cleanUsername: clean,
      url: null,
      errorMessage: "Username do Telegram deve ter entre 5 e 32 caracteres.",
    };
  }

  if (!TELEGRAM_USERNAME_REGEX.test(clean)) {
    return {
      isValid: false,
      cleanUsername: clean,
      url: null,
      errorMessage: "Username do Telegram inválido (use apenas letras, números e _).",
    };
  }

  return {
    isValid: true,
    cleanUsername: clean,
    url: `https://t.me/${clean}`,
  };
}

/**
 * Validates and normalizes a WhatsApp phone number.
 * Must include country code (DDI) and area code (DDD).
 * Strips formatting like +, spaces, parens, hyphens.
 * Does NOT invent or prepend country code automatically.
 */
export function validateAndNormalizeWhatsApp(value: string): {
  isValid: boolean;
  cleanDigits: string;
  url: string | null;
  errorMessage?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      isValid: false,
      cleanDigits: "",
      url: null,
      errorMessage: "Informe o número do WhatsApp.",
    };
  }

  // Reject if contains invalid characters (anything other than digits, +, spaces, parens, hyphens)
  if (/[^0-9+\s()\-.]/.test(trimmed)) {
    return {
      isValid: false,
      cleanDigits: "",
      url: null,
      errorMessage: "Número contém caracteres inválidos. Use apenas dígitos.",
    };
  }

  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return {
      isValid: false,
      cleanDigits: "",
      url: null,
      errorMessage: "Número do WhatsApp inválido.",
    };
  }

  // E.164 max length is 15 digits. Minimum with country code + area code + number is at least 10 digits.
  if (digits.length < 10) {
    return {
      isValid: false,
      cleanDigits: digits,
      url: null,
      errorMessage: "Número incompleto. Informe o código do país e DDD (ex: 5511999999999).",
    };
  }

  if (digits.length > 15) {
    return {
      isValid: false,
      cleanDigits: digits,
      url: null,
      errorMessage: "Número muito longo (máximo 15 dígitos).",
    };
  }

  // Detect Brazilian numbers provided without country code (55).
  // In Brazil: DDD (2 digits) + 8 or 9 digits = 10 or 11 digits total.
  // Brazilian DDDs are between 11 and 99.
  // If user inputs 10 or 11 digits starting with a BR DDD, but without country code '55':
  if (
    (digits.length === 10 || digits.length === 11) &&
    !digits.startsWith("55")
  ) {
    // If it starts with '1' and has 11 digits, check if it could be a valid US/NANP number (+1 [2-9]..):
    const isNanp = digits.length === 11 && /^1[2-9]\d{9}$/.test(digits);
    if (!isNanp) {
      return {
        isValid: false,
        cleanDigits: digits,
        url: null,
        errorMessage: "Número sem código de país. Informe o DDI e DDD (ex: 5511999999999).",
      };
    }
  }

  return {
    isValid: true,
    cleanDigits: digits,
    url: `https://wa.me/${digits}`,
  };
}

/**
 * Validates an external support URL.
 * Only allows safe protocols (https: or http:), strictly rejecting javascript:, data:, etc.
 */
export function validateAndNormalizeExternalLink(value: string): {
  isValid: boolean;
  cleanUrl: string;
  url: string | null;
  errorMessage?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      isValid: false,
      cleanUrl: "",
      url: null,
      errorMessage: "Informe o link de suporte.",
    };
  }

  // Pre-check for dangerous protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return {
      isValid: false,
      cleanUrl: "",
      url: null,
      errorMessage: "Protocolo de link não permitido por motivos de segurança.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      cleanUrl: "",
      url: null,
      errorMessage: "URL inválida. Verifique o formato informado (ex: https://...).",
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      isValid: false,
      cleanUrl: "",
      url: null,
      errorMessage: "Apenas links com protocolo HTTPS ou HTTP são permitidos.",
    };
  }

  if (!parsed.hostname || parsed.hostname.length < 3) {
    return {
      isValid: false,
      cleanUrl: "",
      url: null,
      errorMessage: "URL inválida (domínio incompleto).",
    };
  }

  return {
    isValid: true,
    cleanUrl: parsed.toString(),
    url: parsed.toString(),
  };
}

/**
 * Parses and validates the support configuration for a store.
 */
export function parseSupportConfig(
  type?: string | null,
  value?: string | null
): SupportConfigResult {
  const rawInput = (value ?? "").trim();
  const normalizedType: SupportType =
    type === "whatsapp" || type === "link" ? type : "telegram";

  if (!rawInput) {
    return {
      isValid: false,
      type: normalizedType,
      rawInput: "",
      normalizedValue: "",
      url: null,
      openType: null,
    };
  }

  switch (normalizedType) {
    case "telegram": {
      const res = validateAndNormalizeTelegram(rawInput);
      return {
        isValid: res.isValid,
        type: "telegram",
        rawInput,
        normalizedValue: res.cleanUsername,
        url: res.url,
        openType: res.isValid ? "telegram" : null,
        errorMessage: res.errorMessage,
      };
    }
    case "whatsapp": {
      const res = validateAndNormalizeWhatsApp(rawInput);
      return {
        isValid: res.isValid,
        type: "whatsapp",
        rawInput,
        normalizedValue: res.cleanDigits,
        url: res.url,
        openType: res.isValid ? "external" : null,
        errorMessage: res.errorMessage,
      };
    }
    case "link": {
      const res = validateAndNormalizeExternalLink(rawInput);
      return {
        isValid: res.isValid,
        type: "link",
        rawInput,
        normalizedValue: res.cleanUrl,
        url: res.url,
        openType: res.isValid ? "external" : null,
        errorMessage: res.errorMessage,
      };
    }
  }
}

/**
 * Safely opens a support destination handling both Telegram Mini App and standard browsers.
 */
export function openSupportLink(config: {
  url: string | null;
  openType: "telegram" | "external" | null;
}): void {
  if (!config.url || typeof window === "undefined") return;

  const tgWebApp = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void; openLink?: (url: string) => void } } })
    .Telegram?.WebApp;

  if (config.openType === "telegram" && tgWebApp && typeof tgWebApp.openTelegramLink === "function") {
    tgWebApp.openTelegramLink(config.url);
  } else if (tgWebApp && typeof tgWebApp.openLink === "function") {
    tgWebApp.openLink(config.url);
  } else {
    window.open(config.url, "_blank", "noopener,noreferrer");
  }
}
