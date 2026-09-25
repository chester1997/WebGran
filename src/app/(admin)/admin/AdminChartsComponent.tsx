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
  Legend
} from "recharts";

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface AdminChartsProps {
  type: "revenue" | "orders" | "growth" | "pie";
  data: any[];
}

export function AdminChartsComponent({ type, data }: AdminChartsProps) {
  if (!data || data.length === 0) return null;

  if (type === "revenue") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
          <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
            formatter={(val: any) => [formatCurrency(Number(val || 0)), "Faturamento"]}
          />
          <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (type === "orders") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
          <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
            formatter={(val: any) => [`${val || 0} pedidos`, "Quantidade"]}
          />
          <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "growth") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
          <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
          />
          <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
          <Line type="monotone" dataKey="sellers" name="Novos Vendedores" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="stores" name="Novas Lojas" stroke="#A855F7" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

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
              <Cell key={`cell-${index}`} fill={entry.color} stroke="#141416" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "#18181B", borderColor: "#27272A", borderRadius: "12px", color: "#FFF" }}
            formatter={(val: any, name: any) => [`${val || 0} pedidos`, String(name || "Status")]}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
