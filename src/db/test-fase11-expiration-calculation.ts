import 'dotenv/config';
import { calculateAccessExpiration, formatAccessExpirationBR } from '../lib/orders/expiration-service';

function runTests() {
  console.log("=== WEBGRAN FASE 11 — TESTES UNITÁRIOS DE CÁLCULO DE EXPIRAÇÃO ===");

  const baseline = new Date('2026-09-19T12:00:00Z');
  console.log(`Data Base de Teste (paidAt): ${baseline.toISOString()}`);

  const cases = [
    { duration: 'DAILY', expected: '2026-09-20' },
    { duration: 'WEEKLY', expected: '2026-09-26' },
    { duration: 'BIWEEKLY', expected: '2026-10-03' },
    { duration: 'MONTHLY', expected: '2026-10-19' },
    { duration: 'QUARTERLY', expected: '2026-12-19' },
    { duration: 'ANNUAL', expected: '2027-09-19' },
    { duration: 'LIFETIME', expected: null },
  ];

  let passedCount = 0;

  for (const c of cases) {
    const exp = calculateAccessExpiration(c.duration, baseline);
    let expFormatted = exp ? exp.toISOString().slice(0, 10) : null;

    const match = expFormatted === c.expected;
    if (match) {
      passedCount++;
      console.log(`✅ [PASS] ${c.duration.padEnd(10)} -> ${expFormatted || 'null'} (Esperado: ${c.expected || 'null'})`);
    } else {
      console.error(`❌ [FAIL] ${c.duration.padEnd(10)} -> ${expFormatted} (Esperado: ${c.expected})`);
    }

    // Test BR Formatter
    const brFormat = formatAccessExpirationBR(exp);
    console.log(`   Formatado BR: "${brFormat.dateFormatted}" | Badge: ${brFormat.badgeType}`);
  }

  console.log(`\nTotal de testes: ${cases.length} | Aprovados: ${passedCount}`);

  if (passedCount === cases.length) {
    console.log("✅ SEÇÃO 23 - CÁLCULOS DE EXPIRAÇÃO APROVADOS COM 100% DE SUCESSO!");
  } else {
    console.error("❌ FALHA em algum cálculo de expiração.");
  }
}

runTests();
