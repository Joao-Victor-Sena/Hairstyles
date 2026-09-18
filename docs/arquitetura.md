# Arquitetura

O frontend está em `assets/` e é servido pelo Express. A API fica em `src/server.js`, com regras de autenticação, catálogo e agendamentos. O SQLite é inicializado em `data/hairstyles.db`.

As validações essenciais são repetidas no servidor. Preços e disponibilidade nunca são aceitos do navegador: o servidor consulta o catálogo e os horários livres antes de gravar.

A limitação de requisições usa `express-rate-limit`. Erros de produção retornam mensagens genéricas, sem stack trace ou segredos.
