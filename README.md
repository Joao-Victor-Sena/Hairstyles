# Hairstyles

O Hairstyles é uma aplicação para o salão de beleza Hairstyles. Clientes podem conhecer os serviços, criar uma conta e solicitar horários de atendimento pela internet.

A aplicação foi construída com HTML, CSS, JavaScript, Node.js, Express e SQLite. As imagens da vitrine são placeholders e podem ser substituídas pelos materiais do salão.

O agendamento funciona em três etapas: seleção de um ou mais serviços, escolha de data e horário e confirmação. Os serviços adicionais da mesma reserva são persistidos em `booking_services`.

## Executar

1. Instale o Node.js 20 ou superior.
2. Rode `npm install`.
3. Copie `config/env.example` para `.env` e altere o segredo.
4. Rode `npm run dev`.
5. Abra `http://localhost:3000`.

Para ativar a recuperação por e-mail, preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e, opcionalmente, `SMTP_SECURE` e `MAIL_FROM` no `.env`. Sem SMTP configurado, a API informa que o envio não está disponível e não altera a senha.

O projeto inclui configuração para publicação na Vercel. O banco local fica em `data/`; em produção, use um banco persistente externo antes de escalar o sistema.
