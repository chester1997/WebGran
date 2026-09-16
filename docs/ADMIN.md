# WebGran - Documentação Administrativa

O painel administrativo do WebGran (acessível via `/admin`) é uma área restrita a usuários com a flag `role = 'admin'` no banco de dados.

## Estrutura do Painel

1. **Dashboard (`/admin`)**
   Apresenta uma visão panorâmica e quantitativa da plataforma. Soma faturamentos brutos de todos os pedidos `paid`, e totaliza Lojas, Vendedores, Clientes e Bots em toda a aplicação.

2. **Lojas (`/admin/stores`)**
   Listagem de todas as lojas SaaS hospedadas no WebGran, permitindo a visibilidade da relação entre Vendedor -> Loja -> Bot.

3. **Vendedores (`/admin/sellers`)**
   Lista os usuários com a role `seller`, a data em que ingressaram e quantas lojas possuem.

4. **Bots (`/admin/bots`)**
   Monitora os robôs conectados à API do Telegram associados às lojas.

5. **Temas (`/admin/themes`)**
   Permite gerenciar quais temas de Mini App estão disponíveis no sistema. O WebGran utiliza o conceito de **Tema Forçado**: o Lojista não escolhe seu tema. O Admin da plataforma cadastra os temas no banco (ex: `Studio`, `Netflix`) e determina qual deles é o `isDefault = true`. Quando um vendedor entra, este tema é aplicado.

6. **Configurações (`/admin/settings`)**
   Painel global de configurações, apontando fluxos sistêmicos de alta governança.
