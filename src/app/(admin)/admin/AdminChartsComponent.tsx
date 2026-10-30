"use client";

import React from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface AdminChartsProps {
  type: "gmv" | "orders" | "pix" | "revenue" | "growth" | "pie";
  data: any[];
}

// Custom Tooltip Minimalista estilo Linear / Stripe (sem excesso de brilho ou borda)
function ExecutiveTooltip({ active, payload, label, unit = "BRL" }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#0B0D12]/95 backdrop-blur-md border border-white/[0.08] rounded-lg p-2.5 shadow-xl space-y-1 min-w-[150px] animate-in fade-in-0">
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider border-b border-white/[0.05] pb-1 flex items-center justify-between">
        <span>Data</span>
        <span className="text-zinc-300 font-semibold">{label}</span>
      </div>
      <div className="space-y-0.5 pt-0.5">
        {payload.map((entry: any, idx: number) => {
          const val = entry.value;
          const formatted =
            unit === "BRL"
              ? formatCurrency(Number(val || 0))
              : unit === "count"
              ? `${Number(val || 0).toLocaleString("pt-BR")} pedidos`
              : `${Number(val || 0).toLocaleString("pt-BR")}`;

          return (
            <div key={`item-${idx}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || entry.stroke || "#3B82F6" }}
                />
                <span className="text-[11px]">{entry.name || "Valor"}</span>
              </span>
              <span className="font-mono font-bold text-white tabular-nums">{formatted}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminChartsComponent({ type, data }: AdminChartsProps) {
  if (!data || data.length === 0) return null;

  // Primary GMV Chart: Curva suave, gradiente discreto e grid imperceptível
  if (type === "gmv" || type === "revenue") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gmvDiscreetGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.03)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#52525B"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            stroke="#52525B"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
            dx={-2}
          />
          <Tooltip content={<ExecutiveTooltip unit="BRL" />} />
          <Area
            type="monotone"
            dataKey="gmv"
            name="GMV Aprovado"
            stroke="#3B82F6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#gmvDiscreetGradient)"
            dot={false}
            activeDot={{
              r: 4,
              stroke: "#3B82F6",
              strokeWidth: 2,
              fill: "#0B0D12",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Orders Count Chart: Barras esguias com tom sóbrio
  if (type === "orders") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.03)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#52525B"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            stroke="#52525B"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            dx={-2}
          />
          <Tooltip content={<ExecutiveTooltip unit="count" />} />
          <Bar
            dataKey="ordersCount"
            name="Pedidos Pagos"
            fill="#3B82F6"
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Pix Generated vs Pix Paid Comparison
  if (type === "pix") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.03)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#52525B"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            stroke="#52525B"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            dx={-2}
          />
          <Tooltip content={<ExecutiveTooltip unit="plain" />} />
          <Legend
            wrapperStyle={{ paddingTop: "10px", fontSize: "11px" }}
            formatter={(value) => <span className="text-zinc-400 font-medium text-xs ml-1">{value}</span>}
          />
          <Bar
            dataKey="pixGenerated"
            name="Pix Gerados"
            fill="#334155"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey="ordersCount"
            name="Pix Confirmados"
            fill="#10B981"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Growth Chart
  if (type === "growth") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.03)"
            vertical={false}
          />
          <XAxis dataKey="date" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} dy={6} />
          <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} dx={-2} />
          <Tooltip content={<ExecutiveTooltip unit="plain" />} />
          <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "11px" }} />
          <Line
            type="monotone"
            dataKey="sellers"
            name="Novos Vendedores"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, stroke: "#3B82F6", strokeWidth: 1.5 }}
          />
          <Line
            type="monotone"
            dataKey="stores"
            name="Novas Lojas"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, stroke: "#8B5CF6", strokeWidth: 1.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Pie Chart
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={75}
            paddingAngle={3}
            dataKey="count"
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="#0B0D12" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<ExecutiveTooltip unit="count" />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
