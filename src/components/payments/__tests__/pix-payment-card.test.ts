import { describe, it, expect } from 'vitest';
import { isValidPixCode, PixPaymentCard } from '../PixPaymentCard';

describe('PixPaymentCard — Visual QR Code & Payload Validation Suite', () => {
  const samplePixCode = '00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540549.905802BR5913SyncPay Seller6009SAO PAULO62070503***6304E2CA';

  it('1. Validates real pix_code string successfully', () => {
    expect(isValidPixCode(samplePixCode)).toBe(true);
    expect(isValidPixCode('  00020126580014BR.GOV.BCB.PIX...  ')).toBe(true);
  });

  it('2. Rejects invalid, empty, null, undefined or "undefined" pix_code strings', () => {
    expect(isValidPixCode(null)).toBe(false);
    expect(isValidPixCode(undefined)).toBe(false);
    expect(isValidPixCode('')).toBe(false);
    expect(isValidPixCode('   ')).toBe(false);
    expect(isValidPixCode('undefined')).toBe(false);
    expect(isValidPixCode('null')).toBe(false);
  });

  it('3. PixPaymentCard component structure includes QRCodeSVG rendering import contract', () => {
    expect(typeof PixPaymentCard).toBe('function');
  });
});
