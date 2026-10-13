# NORTH V1.3.2 — edição plana corrigida para publicação pelo celular

Aplicativo pessoal em português brasileiro, feito com HTML, CSS e JavaScript puro, sem frameworks ou etapa de build. O projeto é pensado para ser editado pelo navegador do iPhone e publicado gratuitamente no GitHub Pages.

## O que há nesta versão

- Carteira de moedas com saldo calculado pela soma do extrato.
- Missões únicas, diárias e semanais, com tema selecionável e prevenção de pagamentos duplicados.
- Temas padrão ativáveis/desativáveis e temas pessoais criados pelo usuário.
- Loja de recompensas com minutos de lazer escolhidos em blocos de 1 ou 15 minutos.
- Créditos de lazer acumulados sem contagem regressiva, início automático ou expiração automática.
- Registro manual dos minutos que foram efetivamente utilizados, com histórico e app associado.
- Preferências por aplicativo: "Quero limitar" ou "Manter livre", incluindo entradas personalizadas.
- Estorno financeiro append-only, sem editar ou apagar os lançamentos originais.
- Persistência local com IndexedDB e fallback para localStorage.
- Importação/exportação JSON, espelho opcional no Google Sheets e PWA instalável.
- Migração simples de dados locais de NORTH V1.1 para V1.2.

## Regra dos créditos de lazer

Os créditos são uma carteira de minutos comprados. Exemplo: compra de 30 minutos adiciona 30 ao total disponível; depois de usar 15 minutos, o usuário registra 15 minutos utilizados e ficam 15 disponíveis. O NORTH não inicia temporizadores e não apaga os minutos simplesmente porque o tempo passou. Minutos só são descontados pelo formulário de registro manual.

Em **Personalizar → Preferências**, escolha incrementos de 1 ou 15 minutos. No modo de 15, tanto recompensas quanto registros de uso devem ser múltiplos de 15; no modo de 1, cada minuto é permitido. A regra pode ser alterada a qualquer momento.

## Temas e apps personalizados

Em **Personalizar**, ative ou desative os temas oferecidos, crie seus próprios temas e atribua um tema a cada nova missão. Também é possível escolher apps que deseja limitar ou manter livres e incluir outros nomes.

**Essa lista é uma preferência do NORTH, não um bloqueio do sistema.** Ela não altera o Tempo de Uso do iOS, não monitora o tempo real de TikTok/Instagram e não libera automaticamente minutos comprados. A tela inclui instruções para configurar Limites de Apps manualmente em Ajustes → Tempo de Uso. Atalhos pode ser usado como lembrete, mas pode ser desativado.

## Limites e transparência

- PWA não tem acesso à API privada de Screen Time e não consegue bloquear outros apps do iOS.
- O NORTH não lê quanto tempo foi gasto dentro de outro aplicativo.
- O registro de consumo é manual; confira o Tempo de Uso do iPhone para saber o uso real.
- Os créditos não expiram nem têm contagem regressiva.
- O armazenamento local pode ser apagado ou alterado. Use Exportar backup JSON semanalmente.
- O token do Apps Script no JavaScript público não é um segredo forte. Use o espelho somente como backup pessoal e teste restauração antes de confiar nele.
- A sincronização automática não é garantida em segundo plano no iPhone.

## Publicar pelo iPhone

1. Baixe o ZIP e extraia usando o app Arquivos.
2. Abra https://github.com/new e crie um repositório público chamado `north`.
3. Envie o conteúdo desta pasta à raiz do repositório. `index.html`, `manifest.json` e `sw.js` devem ficar na raiz.
4. No repositório, abra Settings → Pages.
5. Em Build and deployment, selecione Deploy from a branch, a branch `main` e a pasta `/ (root)`, e salve.
6. Aguarde o endereço HTTPS do GitHub Pages.
7. Abra o endereço no Safari e toque em Compartilhar → Adicionar à Tela de Início.
8. Abra a versão instalada, crie uma missão de teste e siga o fluxo de ganho, compra e registro de uso.
9. Exporte um backup e teste a importação antes de adicionar seus dados reais.

## Testes automatizados

Com Node.js em um computador ou ambiente de testes compatível:

```bash
npm test
```

Os testes cobrem saldo, idempotência, compra sem saldo, créditos sem temporizador, consumo manual, incrementos de 1/15, limites de saldo, estornos, temas personalizados e importação inválida.

## Arquivos do projeto (todos na raiz)

Todos os arquivos deste ZIP ficam no mesmo nível, sem subpastas, para facilitar o envio pelo Safari no iPhone. Não renomeie os arquivos.

- `index.html`: interface principal.
- `app.js`: coordena telas e eventos.
- `wallet.js`: regras de moedas, compras, consumo e estornos.
- `tasks.js` e `rewards.js`: validação de missões e recompensas.
- `storage.js`: IndexedDB com fallback para localStorage.
- `backup.js`: exportação e validação de backup JSON.
- `sync.js` e `Code.gs`: espelho opcional no Google Sheets.
- `tokens.css`, `layout.css`, `components.css`: estilos.
- `manifest.json` e `sw.js`: instalação e funcionamento offline.
- `north-icon-192.png`, `north-icon-512.png`, `north-icon-maskable.png`: ícones da PWA.
- `wallet.test.mjs` e `package.json`: testes automatizados (exigem Node.js; não são executados pelo GitHub Pages).
- `README.md` e `CHANGELOG.md`: instruções e histórico.

## Recuperação de dados V1.1

Ao abrir a V1.2 pela primeira vez, a aplicação normaliza os dados existentes. Missões antigas sem tema recebem "Outro". Créditos antigos disponíveis, expirados ou em uso são recuperados como minutos disponíveis porque a nova versão não usa expiração nem temporizador. Créditos antigos finalizados continuam marcados como utilizados; créditos estornados continuam estornados. Faça um backup JSON antes da atualização.

## Google Sheets como espelho

O projeto mantém `Code.gs` e a opção de URL `/exec` na tela Personalizar. Use o passo a passo de configuração do Apps Script no histórico anterior deste projeto; após atualizar o script, publique uma nova implantação. Antes de confiar na planilha para recuperação, faça um teste com dados fictícios e confirme que o snapshot inclui `leisureUsage`, temas e preferências de apps.

## Privacidade

As informações ficam no navegador do dispositivo até você configurar o espelho. O NORTH não envia dados para a planilha sem você configurar o endereço e iniciar a sincronização. Não use este projeto para dados sensíveis.


## Insights de tempo (v1.3)
A seção **Insights** permite registrar duração e categoria de atividades e exibe distribuição por categoria e comparação dos últimos sete dias. O registro é manual: a PWA não tem acesso ao relatório do Tempo de Uso do iOS nem consegue medir automaticamente o tempo dentro do TikTok, Instagram ou outros aplicativos. Para registrar o tempo das redes, consulte Ajustes → Tempo de Uso e digite os minutos no NORTH. Os registros entram no backup JSON.


## Empacotamento plano V1.3.2

Esta edição coloca `index.html`, todos os módulos JavaScript, estilos, ícones, manifest, service worker, testes e `Code.gs` na raiz do repositório. O ZIP não contém uma pasta-mãe nem subpastas. A edição plana muda apenas nomes/caminhos de arquivos e a versão do cache; os testes automatizados foram executados antes e depois da transformação.

## Versão e atualização

A versão do aplicativo, o pacote e o cache estão alinhados em **1.3.2**. Os ícones foram refeitos sem texto, com símbolo centralizado e margem de segurança para reduzir cortes quando mascarados. O cache usa o nome `north-v1-shell-1.3.2-flat`; ao publicar uma versão futura, atualize o nome do cache para forçar a instalação de um novo shell. A atualização do Service Worker pode solicitar confirmação e recarregar a página quando o novo worker assumir o controle.

## Limite dos testes

Os testes automatizados e as verificações estáticas foram executados no ambiente de desenvolvimento. Não é possível confirmar, daqui, o funcionamento de notificações, instalação PWA, Safari offline, permissões iOS nem a implantação real do Google Apps Script no seu iPhone. Faça primeiro um teste de backup e restauração com dados fictícios.
