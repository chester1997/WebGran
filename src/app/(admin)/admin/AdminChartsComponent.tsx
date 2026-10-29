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

export function AdminChartsComponent({ type, data }: AdminChartsProps) {
  if (!data || data.length === 0) return null;

  // Primary GMV Chart: Dark Black + Azul Sutil
  if (type === "gmv" || type === "revenue") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="gmvBlueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111116",
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#FFF",
              fontSize: "12px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
            formatter={(val: any) => [formatCurrency(Number(val || 0)), "GMV Aprovado"]}
            labelFormatter={(label: any) => `Data: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="gmv"
            stroke="#3B82F6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#gmvBlueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Orders Count Bar Chart
  if (type === "orders") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111116",
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#FFF",
              fontSize: "12px",
            }}
            formatter={(val: any) => [`${val || 0} pedidos`, "Pedidos Pagos"]}
            labelFormatter={(label: any) => `Data: ${label}`}
          />
          <Bar dataKey="ordersCount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Pix Generated vs Pix Paid Comparison
  if (type === "pix") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111116",
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#FFF",
              fontSize: "12px",
            }}
            labelFormatter={(label: any) => `Data: ${label}`}
          />
          <Legend wrapperStyle={{ paddingTop: "8px", fontSize: "11px", color: "#A1A1AA" }} />
          <Bar dataKey="pixGenerated" name="Pix Gerados" fill="#64748B" radius={[3, 3, 0, 0]} />
          <Bar dataKey="ordersCount" name="Pix Pagos" fill="#10B981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Growth Chart
  if (type === "growth") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111116",
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#FFF",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
          <Line
            type="monotone"
            dataKey="sellers"
            name="Novos Vendedores"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="stores"
            name="Novas Lojas"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={{ r: 3 }}
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
            innerRadius={60}
            outerRadius={80}
            paddingAngle={4}
            dataKey="count"
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="#111116" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#111116",
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#FFF",
              fontSize: "12px",
            }}
            formatter={(val: any, name: any) => [`${val || 0} pedidos`, String(name || "Status")]}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
