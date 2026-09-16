"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, storeName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ocorreu um erro ao criar a conta.");
      }

      // Auto login
      const loginRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (loginRes?.error) {
        throw new Error("Conta criada, mas falha no auto-login. Vá para a página de login.");
      }

      router.push("/seller");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-950 border border-red-900 text-red-300 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Nome Completo</label>
        <input
          type="text"
          required
          className="appearance-none block w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-md shadow-sm text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">E-mail</label>
        <input
          type="email"
          required
          className="appearance-none block w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-md shadow-sm text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Senha (min. 6 caracteres)</label>
        <input
          type="password"
          required
          minLength={6}
          className="appearance-none block w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-md shadow-sm text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="pt-2 border-t border-zinc-800">
        <label className="block text-sm font-medium text-zinc-300 mb-1">Nome da sua Loja</label>
        <p className="text-xs text-zinc-500 mb-2">Este nome aparecerá para os seus clientes no bot.</p>
        <input
          type="text"
          required
          className="appearance-none block w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-md shadow-sm text-white focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="Minha Loja Genial"
        />
      </div>

      <div className="pt-4">
        <Button 
          type="submit" 
          className="w-full flex justify-center py-2 px-4 rounded-md shadow-sm font-bold bg-white text-black hover:bg-zinc-200"
          disabled={loading}
        >
          {loading ? "Criando loja..." : "Criar Minha Loja"}
        </Button>
      </div>
    </form>
  );
}
