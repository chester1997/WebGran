<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Auto-Commit & Deploy Rule

Sempre que concluir e validar com sucesso qualquer tarefa solicitada pelo usuário (com build verde), faça o `git add`, `git commit` com mensagem descritiva e o `git push origin main` automaticamente para enviar as alterações para a Vercel sem precisar pedir autorização manual.

