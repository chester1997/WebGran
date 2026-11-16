"use client";

import React, { forwardRef } from "react";
import { Search, X, Loader2 } from "lucide-react";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      isLoading = false,
      placeholder = "Pesquisar...",
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClear = () => {
      onChange("");
      onClear?.();
    };

    return (
      <div className={`relative flex items-center w-full min-w-0 ${className}`}>
        <div className="absolute left-3.5 flex items-center pointer-events-none text-[#71717a]">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#3b82f6]" aria-hidden="true" />
          ) : (
            <Search className="w-4 h-4" aria-hidden="true" />
          )}
        </div>

        <input
          ref={ref}
          type="search"
          role="searchbox"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full h-10 pl-10 pr-9 bg-[#111113] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] rounded-xl text-sm text-[#f4f4f5] placeholder:text-[#71717a] outline-none transition-colors duration-150 focus:ring-1 focus:ring-[#3b82f6] disabled:opacity-40 disabled:pointer-events-none [&::-webkit-search-cancel-button]:hidden"
          {...props}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpar pesquisa"
            className="absolute right-3 p-0.5 rounded-md text-[#71717a] hover:text-[#f4f4f5] hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

