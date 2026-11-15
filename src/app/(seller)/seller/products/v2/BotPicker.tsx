"use client";

import React, { useState, useMemo } from "react";
import { Search, Check } from "lucide-react";

export interface BotPickerOption {
  id: string;
  username: string;
  displayName?: string | null;
  photoUrl?: string | null;
}

export interface BotPickerProps {
  bots: BotPickerOption[];
  selectedBotId: string;
  onChangeSelectedBotId: (botId: string) => void;
  selectedBotIds: string[];
  onChangeSelectedBotIds: React.Dispatch<React.SetStateAction<string[]>> | ((updater: string[] | ((prev: string[]) => string[])) => void);
  errors?: {
    selectedBotId?: string;
    selectedBots?: string;
  };
  onClearError?: (field: "selectedBotId" | "selectedBots") => void;
  disabled?: boolean;
}

export function BotPicker({
  bots,
  selectedBotId,
  onChangeSelectedBotId,
  selectedBotIds,
  onChangeSelectedBotIds,
  errors = {},
  onClearError,
  disabled = false,
}: BotPickerProps) {
  const [botSearch, setBotSearch] = useState("");

  const filteredBots = useMemo(() => {
    if (!botSearch.trim()) return bots;
    const q = botSearch.toLowerCase().trim();
    return bots.filter(
      (b) =>
        (b.displayName && b.displayName.toLowerCase().includes(q)) ||
        (b.username && b.username.toLowerCase().includes(q))
    );
  }, [bots, botSearch]);

  const handleSelectOwner = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOwnerId = e.target.value;
    onChangeSelectedBotId(newOwnerId);
    if (newOwnerId && !selectedBotIds.includes(newOwnerId)) {
      onChangeSelectedBotIds((prev: string[]) => [...prev, newOwnerId]);
    }
    onClearError?.("selectedBotId");
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChangeSelectedBotIds(bots.map((b) => b.id));
    onClearError?.("selectedBots");
  };

  const handleDeselectAll = () => {
    if (disabled) return;
    onChangeSelectedBotIds([]);
  };

  const handleToggleBot = (botId: string) => {
    if (disabled) return;
    onChangeSelectedBotIds((prev: string[]) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId]
    );
    onClearError?.("selectedBots");
  };

  return (
    <div className="space-y-3">
      {/* Bot proprietário dropdown */}
      <div data-error={Boolean(errors.selectedBotId)}>
        <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">
          Bot proprietário
        </label>
        <select
          value={selectedBotId}
          onChange={handleSelectOwner}
          disabled={disabled}
          className={`w-full h-[40px] bg-[#161618] rounded-[8px] px-3 text-[13px] text-[#f4f4f5] border focus:border-[#7c3aed] focus:outline-none cursor-pointer transition ${
            errors.selectedBotId ? "border-[#f87171]" : "border-[#2a2a2f]"
          }`}
        >
          <option value="">Selecione um bot...</option>
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName || b.username} (@{b.username})
            </option>
          ))}
        </select>
        {errors.selectedBotId && (
          <p className="text-[12px] text-[#f87171] mt-1">{errors.selectedBotId}</p>
        )}
      </div>

      {/* Multi-bot selection list */}
      <div className="pt-2 border-t border-[#26262a]" data-error={Boolean(errors.selectedBots)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <label className="block text-[12px] font-semibold text-[#f4f4f5]">
              Disponibilidade nos Mini Apps
            </label>
            <p className="text-[11px] text-[#71717a] mt-0.5">
              Selecione um ou mais bots onde este produto ficará disponível.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-medium text-[#a78bfa] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full border border-[#7c3aed]/25">
              {selectedBotIds.length} {selectedBotIds.length === 1 ? "selecionado" : "selecionados"}
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={disabled}
              className="text-[11px] font-medium text-[#a78bfa] hover:text-[#c4b5fd] transition cursor-pointer disabled:opacity-50"
            >
              Selecionar todos
            </button>
            <span className="text-[#3f3f46]">•</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={disabled}
              className="text-[11px] font-medium text-[#71717a] hover:text-[#a1a1aa] transition cursor-pointer disabled:opacity-50"
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {/* Search box */}
        <div className="relative mb-2.5">
          <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou @username..."
            value={botSearch}
            onChange={(e) => setBotSearch(e.target.value)}
            disabled={disabled}
            className="w-full bg-[#161618] border border-[#2a2a2f] rounded-[8px] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#7c3aed] transition"
          />
        </div>

        {/* List container */}
        <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredBots.length === 0 ? (
            <div className="p-4 text-center text-[12px] text-[#71717a] bg-[#161618] rounded-[8px] border border-[#26262a]">
              Nenhum bot encontrado com os termos pesquisados.
            </div>
          ) : (
            filteredBots.map((b) => {
              const isSelected = selectedBotIds.includes(b.id);
              const isOwnerBot = b.id === selectedBotId;

              return (
                <div
                  key={b.id}
                  onClick={() => handleToggleBot(b.id)}
                  className={`p-2.5 rounded-[10px] border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#7c3aed]/10 border-[#7c3aed]/60 shadow-[0_0_12px_rgba(124,58,237,0.12)]"
                      : "bg-[#161618] border-[#26262a] hover:border-[#3f3f46]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Bot Avatar */}
                    <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden border border-[#2a2a2f] bg-[#222226] flex items-center justify-center relative">
                      {b.photoUrl ? (
                        <img
                          src={b.photoUrl}
                          alt={b.displayName || b.username}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full flex items-center justify-center font-bold text-[12px] text-[#a1a1aa] bg-gradient-to-br from-[#27272a] to-[#18181b] ${
                          b.photoUrl ? "absolute inset-0 -z-10" : ""
                        }`}
                      >
                        {(b.displayName || b.username || "B").charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* Bot Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#f4f4f5] truncate">
                          {b.displayName || b.username}
                        </span>
                        {isOwnerBot && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#7c3aed]/25 text-[#c4b5fd] border border-[#7c3aed]/40">
                            Proprietário
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#71717a] truncate font-mono mt-0.5">
                        @{b.username}
                      </div>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-[#7c3aed] border-[#7c3aed] text-white shadow-sm"
                        : "border-[#3f3f46] bg-[#1a1a1e]"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {errors.selectedBots && (
          <p className="text-[12px] text-[#f87171] mt-1.5">{errors.selectedBots}</p>
        )}
      </div>
    </div>
  );
}

