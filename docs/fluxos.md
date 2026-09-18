# Fluxos principais

- Visitante: Início -> catálogo -> login -> cadastro.
- Cliente: login -> seleção de serviço -> data -> horário -> confirmação.
- Perfil: exige token JWT válido e redireciona para login quando ausente.

A recuperação de senha mantém resposta genérica para não revelar se um e-mail existe. A integração de envio de senha temporária deve ser ligada a um provedor transacional antes da produção; o endpoint já deixa o ponto de extensão preparado.
