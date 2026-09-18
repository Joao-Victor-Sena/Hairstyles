# Hairstyles

O Hairstyles é uma aplicação para o salão de beleza Hairstyles. Clientes podem conhecer os serviços, criar uma conta e solicitar horários de atendimento pela internet.

A aplicação foi construída com HTML, CSS, JavaScript, Node.js, Express e SQLite. As imagens da vitrine são placeholders e podem ser substituídas pelos materiais do salão.

## Executar

1. Instale o Node.js 20 ou superior.
2. Rode `npm install`.
3. Copie `config/env.example` para `.env` e altere o segredo.
4. Rode `npm run dev`.
5. Abra `http://localhost:3000`.

O projeto inclui configuração para publicação na Vercel. O banco local fica em `data/`; em produção, use um banco persistente externo antes de escalar o sistema.
