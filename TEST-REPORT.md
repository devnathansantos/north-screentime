# NORTH V1.3.2 — relatório de verificação

## Testes automatizados

Comando executado: `npm test`

- **14 testes aprovados**
- **0 falhas**
- **0 testes ignorados**

Cobertura incluída no conjunto atual: saldo derivado do extrato, idempotência diária, compras sem saldo, créditos sem expiração/temporizador, consumo manual, incrementos de 1/15 minutos, saldo mínimo, estornos, temas personalizados e rejeição de backup inválido.

## Verificações estáticas

- `node --check` executado em todos os arquivos `*.js` da raiz: aprovado.
- `Code.gs` copiado temporariamente para extensão `.js` e verificado com `node --check`: aprovado.
- JSON de `manifest.json` e `package.json`: válido.
- Referências locais encontradas em `index.html` e ícones declarados no manifesto: todos os arquivos existem.
- `manifest.json` mantém `display: standalone`.
- Versão alinhada em `settings.js` e `package.json`: `1.3.2`.
- Cache do Service Worker: `north-v1-shell-1.3.2-flat`.
- ZIP conferido após empacotamento; todos os arquivos estão na raiz, sem subpastas.

## Correções nesta revisão

- Corrigida a versão inconsistente de `settings.js` (1.2.0 → 1.3.2).
- Alinhados package, rótulo da interface, documentação e cache do Service Worker.
- Substituídos os ícones por símbolos de bússola centralizados, sem texto cortado na borda e com margem de segurança para máscara.
- Atualizados README e CHANGELOG com as correções e limitações.

## Limitações não verificadas neste ambiente

Não foi possível validar visualmente em Safari/iOS real, instalação na Tela de Início, execução offline após instalação, publicação real do Apps Script nem sincronização contra uma planilha real. A análise estática não substitui esses testes de integração. A PWA também não consegue ler o relatório Screen Time nem bloquear diretamente outros aplicativos do iOS.
