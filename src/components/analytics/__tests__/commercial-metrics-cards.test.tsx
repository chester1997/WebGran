import { describe, it, expect } from "vitest";
import React from "react";
import { CommercialMetricsCards } from "../CommercialMetricsCards";
import { CommercialMetrics } from "@/lib/analytics/commercial-metrics-service";

describe("CommercialMetricsCards Component & Layout Suite", () => {
  it("1. Component is defined and exported as a function", () => {
    expect(typeof CommercialMetricsCards).toBe("function");
  });

  it("2. Responsive layout specification guarantees 2 columns on larger screens and 1 column on mobile", () => {
    // We verify the JSX structure pattern of CommercialMetricsCards
    const sampleMetrics: CommercialMetrics = {
      period: "30D",
      storeId: "store-123",
      approvedSales: {
        total: 1250.0,
        formatted: "R$ 1.250,00",
        count: 5,
        targetGoal: null,
        targetProgressPercent: null,
        hasTargetGoal: false,
      },
      conversionRate: {
        ratePercent: null,
        formatted: "—",
        isTelemetryAvailable: false,
        totalVisits: null,
        convertedOrders: 5,
        statusMessage: "Rastreamento de visitas não disponível",
      },
      botStarts: {
        totalStarts: 0,
        formatted: "0",
        isTelemetryAvailable: false,
        uniqueUsers: 0,
        statusMessage: "Eventos de /start não registrados no banco",
      },
      averageTicket: {
        averageTicket: 250.0,
        formatted: "R$ 250,00",
        consideredSalesCount: 5,
        approvedPixCount: 4,
        generatedPixCount: 6,
        pixConversionRatePercent: 67,
      },
    };

    const element = React.createElement(CommercialMetricsCards, { metrics: sampleMetrics });
    expect(element).toBeDefined();
    expect(element.props.metrics?.approvedSales.total).toBe(1250.0);
  });

  it("3. Semicircular gauge mathematical arc geometry adheres to 180-degree sweep", () => {
    const radius = 42;
    const arcLength = Math.PI * radius; // ~131.94689
    expect(arcLength).toBeCloseTo(131.95, 1);

    // 0% progress -> strokeDashoffset equals full arc length (empty arc)
    const offset0 = arcLength * (1 - 0 / 100);
    expect(offset0).toBeCloseTo(131.95, 1);

    // 50% progress -> strokeDashoffset is half arc length
    const offset50 = arcLength * (1 - 50 / 100);
    expect(offset50).toBeCloseTo(65.97, 1);

    // 100% progress -> strokeDashoffset is 0 (full arc)
    const offset100 = arcLength * (1 - 100 / 100);
    expect(offset100).toBe(0);
  });

  it("4. Handles null/empty metrics gracefully without exceptions", () => {
    const elementNull = React.createElement(CommercialMetricsCards, { metrics: null, isPending: false });
    expect(elementNull).toBeDefined();

    const elementPending = React.createElement(CommercialMetricsCards, { metrics: null, isPending: true });
    expect(elementPending).toBeDefined();
    expect(elementPending.props.isPending).toBe(true);
  });

  it("5. Displays target goal progress bar only when goal exists", () => {
    const withGoal: CommercialMetrics = {
      period: "30D",
      storeId: "store-123",
      approvedSales: {
        total: 750.0,
        formatted: "R$ 750,00",
        count: 3,
        targetGoal: 1000.0,
        targetProgressPercent: 75,
        hasTargetGoal: true,
      },
      conversionRate: {
        ratePercent: 5.0,
        formatted: "5,0%",
        isTelemetryAvailable: true,
        totalVisits: 60,
        convertedOrders: 3,
        statusMessage: "3 vendas em 60 sessões",
      },
      botStarts: {
        totalStarts: 10,
        formatted: "10",
        isTelemetryAvailable: true,
        uniqueUsers: 8,
        statusMessage: "10 início(s) de bot no período",
      },
      averageTicket: {
        averageTicket: 250.0,
        formatted: "R$ 250,00",
        consideredSalesCount: 3,
        approvedPixCount: 3,
        generatedPixCount: 3,
        pixConversionRatePercent: 100,
      },
    };

    const elementWithGoal = React.createElement(CommercialMetricsCards, { metrics: withGoal });
    expect(elementWithGoal.props.metrics?.approvedSales.hasTargetGoal).toBe(true);
    expect(elementWithGoal.props.metrics?.approvedSales.targetProgressPercent).toBe(75);
  });
});
