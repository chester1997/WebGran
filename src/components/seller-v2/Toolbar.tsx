"use client";

import React, { ReactNode } from "react";

export interface ToolbarProps {
  searchSlot?: ReactNode;
  filterSlot?: ReactNode;
  actionSlot?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Toolbar({
  searchSlot,
  filterSlot,
  actionSlot,
  children,
  className = "",
}: ToolbarProps) {
  return (
    <div
      className={`w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[#0e0e10] border border-[#26262a] rounded-2xl shadow-sm ${className}`}
    >
      {/* Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
        {searchSlot && <div className="flex-1 min-w-0 sm:max-w-md">{searchSlot}</div>}
        {filterSlot && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
            {filterSlot}
          </div>
        )}
      </div>

      {/* Ações / Botões Auxiliares */}
      {actionSlot && (
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {actionSlot}
        </div>
      )}

      {/* Children livre caso não use os slots dedicados */}
      {children}
    </div>
  );
}

