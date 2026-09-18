# Fluxos principais

- Visitante: Início -> catálogo -> login -> cadastro.
- Cliente: login -> seleção de um ou mais serviços -> data -> horário -> revisão -> confirmação.
- Perfil: exige token JWT válido e redireciona para login quando ausente.

A recuperação de senha mantém resposta genérica para não revelar se um e-mail existe e envia uma senha temporária por SMTP quando as variáveis `SMTP_*` estão configuradas.
