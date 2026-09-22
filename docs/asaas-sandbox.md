# Studify Pro / Asaas Sandbox

Implementação: R$ 14,90/mês, trial único de 15 dias desde a criação da conta,
cartão em checkout hospedado e PIX em fatura mensal (pagamento manual).
O trial não exige cartão. Contratar durante o trial agenda a primeira cobrança
para a primeira data local posterior ao seu término. PIX pode ser pago antecipadamente.
Nenhum dado de cartão passa pelo Studify.

## Ativação

1. Aplique `supabase/migrations/012_asaas_billing.sql` no SQL Editor do projeto
   Supabase que já recebeu as migrations 001–011. Não recrie o banco.
2. Configure no servidor e no `.env.local`:
   - `ASAAS_ENV=sandbox`
   - `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`
   - `ASAAS_API_KEY` (chave Sandbox)
   - `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` (acesso administrativo,
     nunca `NEXT_PUBLIC_*`)
   - `ASAAS_WEBHOOK_TOKEN`: segredo independente com pelo menos 32 caracteres.
     Um token aleatório já foi gerado no `.env.local` durante a implementação.
   - `STUDIFY_APP_URL`: origem HTTPS pública do Studify ou túnel para desenvolvimento.
   - `ASAAS_WEBHOOK_EMAIL`: endereço de avisos operacionais do Asaas.
3. Publique o código com as variáveis configuradas, ou exponha o servidor local
   por HTTPS. Reinicie o servidor após alterar variáveis.
4. Execute `node --env-file=.env.local scripts/configure-asaas-webhook.mjs`.
   O script cria/atualiza somente o webhook da URL exata no Sandbox. Alternativamente,
   configure no painel Asaas a URL `https://SEU-DOMINIO/api/asaas/webhook`,
   `authToken` igual a `ASAAS_WEBHOOK_TOKEN`, API v3 e envio sequencial. A lista
   completa de eventos está no script.
5. Confirme entregas HTTP 200 no painel do Asaas. Uma resposta 503 é recuperável;
   depois de corrigir banco/configuração, reative a fila interrompida no painel.

## Segurança e acesso

- `/api/billing/checkout`, `/status` e `/cancel` validam o token Supabase com
  `auth.getUser`. O user_id vem da sessão; preço e ciclo vêm do servidor.
- `externalReference=user_id` identifica customer, checkout e assinatura.
  Quando o checkout não propaga a referência à assinatura, o webhook a preenche
  após validar o customer local e a assinatura no Asaas.
- `/api/asaas/webhook` exige `asaas-access-token`, comparado em tempo constante.
- Customer/provider state e ledger são tabelas privadas com RLS; somente service_role
  pode chamar `apply_asaas_event`. IDs de evento e alteração de entitlement são
  gravados na mesma transação. Falhas não consomem o evento.
- `CHECKOUT_PAID` registra a jornada, mas não libera acesso pago. Os eventos de
  cobrança confirmada/recebida dão acesso até vencimento + um mês de calendário.
- Ordenação por data do evento é por pagamento/assinatura; vencimento de outra
  fatura não retira um período já pago. Estorno/chargeback revoga a parcela.
- Cancelamento remove a recorrência e suas cobranças pendentes no Asaas. O webhook
  mantém o acesso até terminar o período pago ou trial. `get_entitlement()` calcula
  Free na leitura após expiração, inclusive sem novos webhooks; não precisa de cron.
- O trial de 15 dias continua sendo concedido pelo trigger de cadastro da migration
  009. O usuário não consegue renovar ou alterar esse período pelo client.
- Callbacks não têm código de ativação. A tela `/assinatura` consulta apenas o
  estado persistido pelo servidor. A API key jamais entra em resposta ou client bundle.

## Recuperação de operações ambíguas

A reserva `billing_accounts.operation_started_at` impede duas contratações
concorrentes. Em timeout, não se repete um POST de criação automaticamente:
externalReference não é uma chave de idempotência do Asaas.

Antes de liberar uma reserva que permaneceu pendente, consulte no Asaas o customer
por `externalReference=user_id`, a assinatura por customer e os logs do checkout.
Persista os IDs recuperados e reenvie os webhooks correspondentes. Somente depois
limpe `operation_started_at` e `operation_kind` com acesso administrativo. Nunca
limpe às cegas: isso pode duplicar cobranças. Erros de validação HTTP 400 do Asaas
liberam a reserva, pois a criação foi rejeitada.

## Validação

`npm run typecheck`, `npm test`, ESLint nos arquivos alterados e
`npm run build -- --webpack` passaram. O build padrão com Turbopack falhou
no ambiente de execução ao tentar abrir uma porta interna (EPERM).
Os testes PGlite executam a migration e verificam duplicidade, ordenação,
cancelamento, estorno, mês de calendário, trial, expiração, rollback e permissões.
A autenticação real da chave no Sandbox foi validada com consulta somente leitura.

Antes de considerar a integração ativa, testar com conta autenticada: checkout de
cartão, fatura PIX, confirmação, renovação, pagamento recusado, evento reenviado,
evento atrasado, cancelamento e fim do trial. Isso requer a migration aplicada,
a chave administrativa e um webhook público acessível. A implementação isolada
não comprova que a fila de webhooks foi configurada na conta Asaas.

Referências oficiais:
- https://docs.asaas.com/docs/checkout-com-assinatura-recorrente
- https://docs.asaas.com/docs/faq-assinaturas
- https://docs.asaas.com/docs/eventos-para-assinaturas
- https://docs.asaas.com/reference/remover-assinatura
