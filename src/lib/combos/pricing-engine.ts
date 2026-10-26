/**
 * Progressive Pricing Engine (Motor de Domínio Puro de Precificação Progressiva)
 *
 * Implementa cálculo determinístico de ofertas progressivas por quantidade (Mix-and-Match Volume Tiers).
 * Utiliza estritamente centavos inteiros para evitar imprecisões de ponto flutuante.
 *
 * Regras principais:
 * 1. Cada unidade de item elegível é contabilizada no máximo uma vez.
 * 2. As unidades cobertas pelas faixas promocionais priorizam os itens de maior preço individual,
 *    maximizando a economia real para o cliente.
 * 3. As unidades restantes não cobertas por nenhuma faixa são cobradas pelo preço individual regular cheio.
 * 4. Combinações múltiplas de faixas (repetidas ou heterogêneas) são avaliadas via Programação Dinâmica.
 * 5. Se qualquer combinação de faixas resultar em valor maior que o preço cheio, o motor protege o cliente,
 *    retornando economia zero e cobrando apenas o valor regular.
 */

export interface ProgressiveTier {
  id?: string;
  minQuantity: number; // Quantidade de itens para ativar a faixa (mínimo 2)
  priceCents: number;  // Preço total da faixa em centavos inteiros (ex: 1200 para R$ 12,00)
}

export interface PricingItemInput {
  id: string;          // Identificador único do item no carrinho/produto
  priceCents: number;  // Preço regular individual em centavos inteiros (>= 0)
  title?: string;
}

export interface AppliedTierSummary {
  tierId?: string;
  minQuantity: number;
  priceCents: number;
  count: number;               // Quantas vezes esta faixa foi aplicada
  totalCoveredUnits: number;   // count * minQuantity
  totalPriceCents: number;     // count * priceCents
}

export interface NextTierProgress {
  targetQuantity: number;                 // Próxima quantidade que desbloqueia uma faixa
  unitsRemaining: number;                 // Quantas unidades faltam adicionar
  targetTierPriceCents: number;           // Preço da próxima faixa
  projectedAdditionalSavingsCents: number;// Estimativa de economia adicional ao atingir a faixa
}

export interface ProgressivePricingResult {
  totalUnits: number;                     // Total de unidades elegíveis analisadas
  coveredUnits: number;                   // Unidades cobertas por faixas promocionais
  regularUnits: number;                   // Unidades cobradas a preço cheio individual
  regularSubtotalCents: number;           // Soma dos preços regulares de todos os itens
  finalPriceCents: number;                // Preço final otimizado a ser cobrado
  savingsCents: number;                   // Economia total em centavos (regularSubtotal - finalPrice)
  savingsPercentage: number;              // Percentual inteiro de desconto (0 a 100)
  appliedTiers: AppliedTierSummary[];     // Lista consolidada de faixas utilizadas
  regularItems: PricingItemInput[];       // Itens específicos cobrados a preço regular
  tierCoveredItems: PricingItemInput[];   // Itens específicos alocados nas faixas promocionais
  nextTierProgress: NextTierProgress | null;
}

export class ProgressivePricingEngine {
  /**
   * Valida rigorosamente as faixas configuradas.
   */
  static validateTiers(tiers: ProgressiveTier[]): void {
    if (!Array.isArray(tiers)) {
      throw new Error("As faixas de promoção devem ser fornecidas em um array.");
    }

    const seenQuantities = new Set<number>();

    for (const tier of tiers) {
      if (
        typeof tier.minQuantity !== "number" ||
        !Number.isInteger(tier.minQuantity) ||
        tier.minQuantity < 2
      ) {
        throw new Error(
          `Quantidade mínima da faixa inválida: ${tier.minQuantity}. Deve ser um número inteiro maior ou igual a 2.`
        );
      }

      if (
        typeof tier.priceCents !== "number" ||
        !Number.isInteger(tier.priceCents) ||
        tier.priceCents <= 0
      ) {
        throw new Error(
          `Preço da faixa inválido: ${tier.priceCents}. Deve ser um número inteiro positivo em centavos.`
        );
      }

      if (seenQuantities.has(tier.minQuantity)) {
        throw new Error(
          `Quantidade duplicada encontrada nas faixas: ${tier.minQuantity} unidades já configurada.`
        );
      }
      seenQuantities.add(tier.minQuantity);
    }
  }

  /**
   * Valida rigorosamente a lista de itens.
   */
  static validateItems(items: PricingItemInput[]): void {
    if (!Array.isArray(items)) {
      throw new Error("A lista de itens deve ser um array.");
    }

    for (const item of items) {
      if (
        typeof item.priceCents !== "number" ||
        !Number.isInteger(item.priceCents) ||
        item.priceCents < 0
      ) {
        throw new Error(
          `Preço individual do item ${item.id} inválido (${item.priceCents}). Deve ser um número inteiro não-negativo em centavos.`
        );
      }
    }
  }

  /**
   * Calcula a melhor combinação de faixas para uma lista de itens elegíveis.
   *
   * @param items Lista de itens elegíveis (cada item representa 1 unidade)
   * @param tiers Faixas de quantidade e preço configuradas na promoção
   */
  static calculate(
    items: PricingItemInput[],
    tiers: ProgressiveTier[],
    skipNextTierProgress = false
  ): ProgressivePricingResult {
    ProgressivePricingEngine.validateTiers(tiers);
    ProgressivePricingEngine.validateItems(items);

    const N = items.length;

    // Caso base: carrinho vazio
    if (N === 0) {
      const smallestTier = tiers.length > 0
        ? [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)[0]
        : null;

      return {
        totalUnits: 0,
        coveredUnits: 0,
        regularUnits: 0,
        regularSubtotalCents: 0,
        finalPriceCents: 0,
        savingsCents: 0,
        savingsPercentage: 0,
        appliedTiers: [],
        regularItems: [],
        tierCoveredItems: [],
        nextTierProgress: smallestTier
          ? {
              targetQuantity: smallestTier.minQuantity,
              unitsRemaining: smallestTier.minQuantity,
              targetTierPriceCents: smallestTier.priceCents,
              projectedAdditionalSavingsCents: 0,
            }
          : null,
      };
    }

    // Ordenar itens decrescentemente por preço: os mais caros vêm primeiro.
    // Assim, ao cobrir K itens em faixas, os itens de 0 a K-1 (mais caros) recebem o desconto,
    // e os itens de K a N-1 (mais baratos) sobram para cobrança pelo preço cheio regular.
    const sortedItems = [...items].sort((a, b) => b.priceCents - a.priceCents);

    // Pré-computar soma dos preços regulares restantes
    // remainingCost[k] = soma dos preços dos itens de índice k até N - 1
    const remainingCost = new Array<number>(N + 1).fill(0);
    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let j = k; j < N; j++) {
        sum += sortedItems[j].priceCents;
      }
      remainingCost[k] = sum;
    }
    remainingCost[N] = 0;

    const regularSubtotalCents = remainingCost[0];

    // Se não houver faixas cadastradas, cobra tudo pelo preço regular
    if (tiers.length === 0) {
      return {
        totalUnits: N,
        coveredUnits: 0,
        regularUnits: N,
        regularSubtotalCents,
        finalPriceCents: regularSubtotalCents,
        savingsCents: 0,
        savingsPercentage: 0,
        appliedTiers: [],
        regularItems: sortedItems,
        tierCoveredItems: [],
        nextTierProgress: null,
      };
    }

    // Programação Dinâmica para encontrar o menor custo para cobrir exatamente k unidades
    // dp[k] = { cost: menor custo em centavos, tiers: lista de faixas utilizadas }
    interface DpState {
      cost: number;
      tiers: ProgressiveTier[];
    }

    const dp: (DpState | null)[] = new Array(N + 1).fill(null);
    dp[0] = { cost: 0, tiers: [] };

    // Ordenação determinística das faixas para consistência de desempate
    const sortedTiers = [...tiers].sort((a, b) => {
      // 1. Menor preço por unidade
      const unitA = a.priceCents / a.minQuantity;
      const unitB = b.priceCents / b.minQuantity;
      if (unitA !== unitB) return unitA - unitB;
      // 2. Maior quantidade mínima (pacotes maiores primeiro)
      if (b.minQuantity !== a.minQuantity) return b.minQuantity - a.minQuantity;
      return a.priceCents - b.priceCents;
    });

    for (let k = 1; k <= N; k++) {
      let bestForK: DpState | null = null;

      for (const tier of sortedTiers) {
        if (k >= tier.minQuantity) {
          const prevState = dp[k - tier.minQuantity];
          if (prevState !== null) {
            const candidateCost = prevState.cost + tier.priceCents;
            const candidateTiers = [...prevState.tiers, tier];

            if (bestForK === null || candidateCost < bestForK.cost) {
              bestForK = { cost: candidateCost, tiers: candidateTiers };
            } else if (candidateCost === bestForK.cost) {
              // Desempate determinístico: preferir menor número de pacotes (pacotes maiores)
              if (candidateTiers.length < bestForK.tiers.length) {
                bestForK = { cost: candidateCost, tiers: candidateTiers };
              }
            }
          }
        }
      }

      dp[k] = bestForK;
    }

    // Avaliar qual k (0 <= k <= N) produz o MENOR custo total final:
    // Custo Total = dp[k].cost + remainingCost[k]
    let bestK = 0;
    let bestFinalCost = regularSubtotalCents;
    let bestTiers: ProgressiveTier[] = [];

    for (let k = 0; k <= N; k++) {
      const state = dp[k];
      if (state !== null) {
        const candidateTotal = state.cost + remainingCost[k];

        // Otimização estrita: menor preço total.
        // Se empatar em valor final:
        // 1. Preferir cobrir mais unidades promocionalmente (maior k)
        // 2. Preferir menor quantidade de pacotes
        if (
          candidateTotal < bestFinalCost ||
          (candidateTotal === bestFinalCost && k > bestK) ||
          (candidateTotal === bestFinalCost && k === bestK && state.tiers.length < bestTiers.length)
        ) {
          bestFinalCost = candidateTotal;
          bestK = k;
          bestTiers = state.tiers;
        }
      }
    }

    // Se nenhuma combinação for economicamente vantajosa ou viável, garante zero savings
    const savingsCents = Math.max(0, regularSubtotalCents - bestFinalCost);
    const savingsPercentage =
      regularSubtotalCents > 0 && savingsCents > 0
        ? Math.round((savingsCents / regularSubtotalCents) * 100)
        : 0;

    // Consolidar faixas aplicadas por quantidade/ID
    const tierMap = new Map<number, AppliedTierSummary>();
    for (const t of bestTiers) {
      const existing = tierMap.get(t.minQuantity);
      if (existing) {
        existing.count += 1;
        existing.totalCoveredUnits += t.minQuantity;
        existing.totalPriceCents += t.priceCents;
      } else {
        tierMap.set(t.minQuantity, {
          tierId: t.id,
          minQuantity: t.minQuantity,
          priceCents: t.priceCents,
          count: 1,
          totalCoveredUnits: t.minQuantity,
          totalPriceCents: t.priceCents,
        });
      }
    }
    const appliedTiers = Array.from(tierMap.values()).sort(
      (a, b) => b.minQuantity - a.minQuantity
    );

    // Divisão física dos itens
    const tierCoveredItems = sortedItems.slice(0, bestK);
    const regularItems = sortedItems.slice(bestK);

    // Cálculo do próximo degrau promocional (Next Tier Milestone)
    let nextTierProgress: NextTierProgress | null = null;
    const sortedByMinQty = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

    if (!skipNextTierProgress) {
      if (N < sortedByMinQty[0].minQuantity) {
        // Abaixo da menor faixa: próximo objetivo é a menor faixa
        const firstTier = sortedByMinQty[0];
        const avgPrice = N > 0 ? regularSubtotalCents / N : firstTier.priceCents / firstTier.minQuantity;
        const projectedFull = avgPrice * firstTier.minQuantity;
        const projSavings = Math.max(0, Math.round(projectedFull - firstTier.priceCents));

        nextTierProgress = {
          targetQuantity: firstTier.minQuantity,
          unitsRemaining: firstTier.minQuantity - N,
          targetTierPriceCents: firstTier.priceCents,
          projectedAdditionalSavingsCents: projSavings,
        };
      } else {
        // Já atingiu ao menos uma faixa: procurar a próxima quantidade alvo que traz novo benefício
        const candidates: number[] = [];
        for (const t of sortedByMinQty) {
          if (t.minQuantity > N) {
            candidates.push(t.minQuantity);
          }
        }

        // Também avaliar combinações aditivas imediatas (ex: se tem 3 e existe faixa 3 e 4, próximas metas: 4, 6 [3+3], 7 [3+4])
        for (const t of sortedByMinQty) {
          const nextComboTarget = bestK + t.minQuantity;
          if (nextComboTarget > N) {
            candidates.push(nextComboTarget);
          }
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => a - b);
          const targetQuantity = candidates[0];
          const unitsRemaining = targetQuantity - N;

          // Projeção simples de preço usando preço médio do carrinho
          const avgPriceCents = Math.round(regularSubtotalCents / N);
          const projectedItems: PricingItemInput[] = [
            ...sortedItems,
            ...Array.from({ length: unitsRemaining }, (_, i) => ({
              id: `proj-${i}`,
              priceCents: avgPriceCents,
            })),
          ];

          const projectedResult = ProgressivePricingEngine.calculate(projectedItems, tiers, true);
          const projectedAdditionalSavingsCents = Math.max(0, projectedResult.savingsCents - savingsCents);

          // Encontrar preço da faixa mais relevante para essa meta
          const matchingTier = sortedByMinQty.find((t) => t.minQuantity === targetQuantity);

          nextTierProgress = {
            targetQuantity,
            unitsRemaining,
            targetTierPriceCents: matchingTier ? matchingTier.priceCents : projectedResult.finalPriceCents,
            projectedAdditionalSavingsCents,
          };
        }
      }
    }

    return {
      totalUnits: N,
      coveredUnits: bestK,
      regularUnits: N - bestK,
      regularSubtotalCents,
      finalPriceCents: bestFinalCost,
      savingsCents,
      savingsPercentage,
      appliedTiers,
      regularItems,
      tierCoveredItems,
      nextTierProgress,
    };
  }
}
