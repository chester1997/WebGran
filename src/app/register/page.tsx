import { Suspense } from "react";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-white">
          <div className="w-12 h-12 bg-white rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <span className="text-black font-black text-2xl tracking-tighter">W</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          Crie sua Loja Virtual
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Venda no Telegram de forma 100% automatizada.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-zinc-900 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-zinc-800">
          <Suspense fallback={<div className="text-zinc-500 text-center">Carregando...</div>}>
            <RegisterForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Já tem uma conta? <a href="/login" className="text-white hover:underline">Faça login</a>
        </p>
      </div>
    </div>
  );
}
