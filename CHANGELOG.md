# Histórico de versões NORTH

## V1.3.2 — correções de consistência e ícones

- Alinhada a versão em `settings.js`, `package.json`, interface e Service Worker para 1.3.2.
- Alterado o nome do cache para `north-v1-shell-1.3.2-flat`, evitando reutilizar o shell 1.3.1.
- Refeitos os três ícones com símbolo de bússola centralizado, sem texto na borda e com margem de segurança para máscaras.
- Atualizados README e relatório de testes para explicar a versão e a atualização do cache.
- Mantida a edição plana: todos os arquivos ficam na raiz do repositório.

## NORTH V1.2.0 — 2026-10-13

- Removida a contagem regressiva interna e a expiração automática dos créditos de lazer.
- Minutos comprados agora ficam numa carteira acumulada até serem consumidos manualmente.
- Adicionado registro manual de minutos utilizados, com histórico e escolha do app associado.
- Adicionado incremento configurável de 1 ou 15 minutos, validado ao criar recompensas e registrar uso.
- Adicionados temas padrão configuráveis e criação de temas personalizados para missões.
- Cada missão mostra seu tema, e o tema é selecionável ao criar uma missão.
- Adicionada configuração de apps por preferência: "Quero limitar" ou "Manter livre", incluindo apps personalizados.
- Adicionadas explicações claras de que as preferências não aplicam limites no iOS.
- Reestruturada a navegação para incluir Personalizar.
- Adicionada migração de dados da V1.1 para o novo modelo, preservando saldo e créditos; créditos antigos que estavam expirados ou em uso são recuperados como disponíveis, e créditos antigos finalizados são marcados como consumidos.
- Atualizada a PWA e o nome de cache para V1.2.0.
- Ampliados os testes da carteira para consumo manual, incrementos e estorno após uso.

## NORTH V1.1.0 — 2026-10-13

- Corrigida a chave de recorrência para usar a data local do dispositivo, não UTC.
- Créditos comprados agora expiram sete dias após a compra e só começam a contar manualmente.
- Estorno de compra invalida o crédito de lazer correspondente.
- Adicionada a tela Configurar bloqueio à navegação.
- Restaurar da planilha recupera um snapshot completo.
- Sincronização tenta reenviar dados pendentes quando a conexão volta.
- Adicionados campos de conversão e lembrete de backup.
- Cache PWA versionado e aviso de nova versão.
- Ampliada a suíte de testes da carteira.

## NORTH V1.0.0 — 2026-10-13

- Consolidada a carteira com extrato append-only, idempotência, compras, créditos internos e estornos.
- Adicionada persistência local IndexedDB com fallback para localStorage.
- Adicionada exportação/importação de backup JSON com validação.
- Adicionada interface mobile-first em português brasileiro.
- Adicionado manifesto PWA, cache offline e configuração `standalone`.
- Adicionado endpoint Apps Script para espelho de lançamentos no Google Sheets.
- Adicionados testes da carteira sem dependências externas.
- Documentadas limitações do iOS para monitoramento e bloqueio de outros aplicativos.

## Limitações permanentes desta PWA

O NORTH web não lê o Screen Time e não bloqueia/desbloqueia apps do iPhone. A lista de apps é uma preferência para ajudar o usuário a configurar Ajustes → Tempo de Uso. Os minutos comprados são créditos internos: o usuário precisa registrar manualmente os minutos usados. A PWA não inicia nem executa cronômetros em segundo plano.


## 1.3.1 — Insights de tempo
- Adicionada a seção Insights com gráficos por categoria e comparação diária dos últimos sete dias.
- Adicionado registro manual de tempo para estudos, trabalho, programação, exercícios, redes sociais, vídeos, jogos e outras atividades.
- Os registros de tempo são incluídos no estado local e nos backups JSON.
- O painel diferencia tempo produtivo registrado de redes sociais/entretenimento registrados manualmente; não declara acesso automático ao Screen Time do iOS.
- Atualizada a versão do cache do Service Worker para evitar servir a interface anterior.


## 1.3.1 — edição plana e revisão de arquivos

- Colocados todos os arquivos na raiz, sem subpastas, para facilitar upload pelo iPhone.
- Atualizados imports ES modules, links CSS/ícones, caminhos do manifesto e lista do service worker.
- Atualizado o cache para `north-v1-shell-1.3.1-flat`, para não reaproveitar o shell anterior.
- Ajustado o comando de testes ao nome plano `wallet.test.mjs`.
- Executados testes automatizados e verificações estáticas dos arquivos, referências e recursos.
