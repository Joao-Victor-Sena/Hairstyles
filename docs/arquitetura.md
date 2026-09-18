# Arquitetura

O frontend está em `assets/` e é servido pelo Express. A API fica em `src/server.js`, com regras de autenticação, catálogo e agendamentos. O SQLite é inicializado em `data/hairstyles.db`.

As validações essenciais são repetidas no servidor. Preços e disponibilidade nunca são aceitos do navegador: o servidor consulta o catálogo e os horários livres antes de gravar. Uma reserva possui um serviço principal compatível com o modelo legado e seus demais itens em `booking_services`.

A limitação de requisições usa `express-rate-limit`. A recuperação de senha usa Nodemailer com SMTP configurado em `config/env.example`. Erros de produção retornam mensagens genéricas, sem stack trace ou segredos.
