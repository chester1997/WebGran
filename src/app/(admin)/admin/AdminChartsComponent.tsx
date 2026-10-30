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

// Custom Tooltip com acabamento Titanium Executive (Stripe/Linear style)
function ExecutiveTooltip({ active, payload, label, unit = "BRL" }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#090A0E]/95 backdrop-blur-md border border-white/[0.12] rounded-xl p-3 shadow-2xl space-y-1.5 min-w-[170px] animate-in fade-in-0 zoom-in-95">
      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-white/[0.06] pb-1.5 flex items-center justify-between">
        <span>Data</span>
        <span className="text-zinc-200 font-semibold">{label}</span>
      </div>
      <div className="space-y-1 pt-0.5">
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
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || entry.stroke || "#3B82F6" }}
                />
                <span className="text-[11px] font-medium">{entry.name || "Valor"}</span>
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

  // Primary GMV Chart: Curva de alta definição com gradiente azul titânio
  if (type === "gmv" || type === "revenue") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gmvExecutiveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="50%" stopColor="#2563EB" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
            dx={-4}
          />
          <Tooltip content={<ExecutiveTooltip unit="BRL" />} />
          <Area
            type="monotone"
            dataKey="gmv"
            name="GMV Aprovado"
            stroke="#3B82F6"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#gmvExecutiveGradient)"
            dot={false}
            activeDot={{
              r: 5,
              stroke: "#60A5FA",
              strokeWidth: 2,
              fill: "#090A0E",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Orders Count Chart: Barras com cantos arredondados e foco em densidade
  if (type === "orders") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            dx={-4}
          />
          <Tooltip content={<ExecutiveTooltip unit="count" />} />
          <Bar
            dataKey="ordersCount"
            name="Pedidos Pagos"
            fill="#3B82F6"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Pix Generated vs Pix Paid Comparison
  if (type === "pix") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            dx={-4}
          />
          <Tooltip content={<ExecutiveTooltip unit="plain" />} />
          <Legend
            wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: "#A1A1AA" }}
            formatter={(value) => <span className="text-zinc-300 font-medium text-xs ml-1">{value}</span>}
          />
          <Bar
            dataKey="pixGenerated"
            name="Pix Gerados"
            fill="#475569"
            radius={[5, 5, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="ordersCount"
            name="Pix Confirmados"
            fill="#10B981"
            radius={[5, 5, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Growth Chart
  if (type === "growth") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis dataKey="date" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} dx={-4} />
          <Tooltip content={<ExecutiveTooltip unit="plain" />} />
          <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
          <Line
            type="monotone"
            dataKey="sellers"
            name="Novos Vendedores"
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, stroke: "#60A5FA", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="stores"
            name="Novas Lojas"
            stroke="#A855F7"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, stroke: "#C084FC", strokeWidth: 2 }}
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
            outerRadius={78}
            paddingAngle={4}
            dataKey="count"
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="#090A0E" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<ExecutiveTooltip unit="count" />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
