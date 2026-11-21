# Run Run Sahur

Endless runner 3D com o Tung Tung Sahur (gênero do Subway Surfers, **sem metrô**), feito para o **californiagames.io** (PlataformaSDK), com build também para a **Y8**. É **HTML + JavaScript puro**: ES modules nativos, three.js vendorizado e nada de bundler.

O pacote do portal fica em `../jogos/distribuicao/runrunsahur/californiagames/`: build, mídias, ficha, roteiro da prova e notas. A build da **Y8** fica em `../jogos/distribuicao/runrunsahur/y8/` (zip e ficha).

## Decisões do dono
Laboratório da Fase 1 em `modelos/`, registrado em `docs/decisao.md`:
- **P1 (fiel ao meme)**, com membros e taco engrossados;
- **dois mapas**, Vila do Sahur (noite → amanhecer) e Rio de toras (manhã), escolhidos na tela de início;
- estilo **3D de brinquedo**;
- **tudo em código**: personagem, cenários, texturas e sons, sem arquivos de modelo, imagem ou áudio;
- a "fala real" do meme **não** entra (o áudio é do criador). A voz é sintetizada por formantes (`src/core/audio.js`, `falar`/`falaSahur`).

Toda proposta visual vai como protótipo jogável ou print, nunca como descrição.

## Regras do jogo
- **3 faixas.** Pula e rola; a tacada (toque curto ou espaço) quebra caixotes e barris.
- **Trombada:** bater de frente num obstáculo comum **derruba o obstáculo** (ele sai voando) e derruba a velocidade.
  - O fator cai para `CHOQUE.leve` 0,55 ou `forte` 0,3 (carrinho, becak, tora rolando) e volta proporcional à velocidade base.
  - A perda fica em ~4,6 m (leve) e ~11 m (forte) em qualquer velocidade.
- **Plataforma sem rampa:** o Sahur **escala** a parede (`escalou`, 0,42).
- **Tropeço de lado:** volta para a faixa de antes (0,62).
- **Chefe (perseguidor):** corre sempre na velocidade base.
  - Com o Sahur mais lento, ele encurta a distância. Correndo limpo, recua 1,1 m/s até `DIST_MAX` 14.
  - Pega com 0,9 m: duas trombadas fortes seguidas pegam. Começa a 4 m.
- **Mortes:** pego, serra (só no rio: `serra: true` nos blocos, corta o Sahur ao meio, de frente ou de lado) e água (vão do rio).
- **Modo Sahur** (tambor, 8 s):
  - estrela: o Sahur pisca nas cores do arco-íris, fica 18% mais rápido e invencível, quebra tudo (até a serra) e anda sobre a água;
  - no último 1,5 s pisca devagar, avisando que vai acabar.
- **Ímã:** 10 s.

## Estrutura
- **`src/jogo/`: lógica pura, testada no Node.**
  - `rng.js`;
  - `pista.js`: gerador por trechos com semente;
  - `corredor.js`: física, com `chaoEm`, `solido`, colisões que devolvem `{ tipo, e, forte }` e a queda 1,3× mais pesada que a subida;
  - `regras.js`: fator de velocidade, chefe, poderes, `reviver`;
  - `autopiloto.js`: busca de 2 ações mais `reflexo`. Trombar conta como ruim, e o poder vale como 25 moedas.
- **`src/render/`:**
  - `motor.js`, `estilo-brinquedo.js`, `modelo.js`, `texturas.js` e `efeitos.js` (serragem, estrelinhas, riscos de velocidade);
  - `personagem.js`: o P1 com o corpo em **duas metades** (esquerda/direita, cada uma com metade do rosto, um braço e a face do corte em `ShapeGeometry`). A serra separa as metades;
  - `mundo.js`: **um por mapa**, tudo num grupo `raiz` (trocar de mapa = trocar o grupo na cena). Cuida dos obstáculos derrubados (balística) e do chefe com materiais clonados semitransparentes (0,38), numa faixa comprimida entre a câmera e o Sahur (`z = 1,5 + dist·0,48`) e escondido no menu;
  - `camera.js`: segue com atraso, tem tremor, o FOV cresce com a velocidade e no modo Sahur, e faz a câmera de início (de frente);
  - `cenarios/{comum,vila,rio}.js`: `montar(raiz)` devolve a névoa. Os dois mapas têm uma luz pontual (no rio quase apagada), e o Sahur leva a sua; isso mantém os shaders iguais na troca de mapa.
- **`src/core/`:**
  - `plataforma.js`: **único módulo que fala com a SDK**. Sem a SDK vira um substituto (o premiado libera direto e o idioma vem do navegador);
  - `plataforma-y8.js`: o adaptador da Y8, com a mesma interface. Só entra na build da Y8, gravado no lugar do `plataforma.js` com os ids;
  - `audio.js`: compressor e buses fx/voz/música/ambiente; `mudo` é do jogador e `calado` do portal ou anúncio;
  - `armazenamento.js`: prefixo `rrs:`, com recorde por mapa (`recorde:vila`/`recorde:rio`), `mapa`, `mudo` e `dicas`;
  - `depuracao.js`.
- **`src/ui/`:** `controles.js`, `hud.js` (perigo do chefe, borda arco-íris e clarão do modo Sahur) e `textos.js` (**pt-BR, en, es**, com `definirIdioma` e os atributos `data-t`).
- **`src/main.js`:**
  - `await plataforma.iniciado` **antes** da carga pesada, e `respirar()` entre as etapas. Se a thread travar logo depois do `init()`, a SDK cai em modo autônomo (ver `notas-doc.md` do pacote);
  - pausa = jogador ∪ portal ∪ anúncio; `sincronizarGameplay()` decide `gameplayStart`/`Stop`;
  - `__rrs` são os ganchos da prova (`autopiloto(on)`, `agora()`, estado, etc.).
- **`modelos/`:** laboratório da Fase 1, só como registro, mais `vitrine.html`, com o personagem e todas as animações (`?cortar`, `?estrela`, `?trombada`).

## SDK (californiagames)
- **Intervalos:**
  - `commercialBreak` em "Correr de novo" e "Trocar de mapa", depois do fim da corrida;
  - `rewardedBreak({ size: 'medium' })` em "Continuar", uma vez por corrida, escondido com bloqueador.
- **Sinais:** `pause`/`resume`/`mute`/`unmute` são idempotentes e somados ao estado do jogo.
- **Métricas:** `measure('run', mapa, 'start'|'end')` e `measure('death', motivo)`.

## SDK (Y8)
- **Build:** `tools/empacotar.mjs --alvo=y8` põe a tag async do SDK 2-0 (CDN da Y8, com `onerror` que liga `__sdkFalhou` e dispara `y8sdk.falhou`) no `<head>` e troca o `plataforma.js` pelo `plataforma-y8.js`, com o `appId` e o `gameId` de `package.json` → `portais.y8`.
  - Nenhum outro portal no zip, nem em comentário; nenhuma URL além do SDK.
- **Prontidão:** `y8sdk.ready` mais `emitReadyEvent()`. Os ouvintes são de **captura**: o `dispatchEvent` do `onerror` é o do `<script>`, e o evento não borbulha. Com bloqueador, o jogo segue na hora, sem o botão de vídeo.
- **Intersticial** (`showAd` `next`): só no clique em "Correr de novo" ou "Trocar de mapa".
  - No máximo um a cada 180 s, contados desde o início do jogo (o pre-roll da Y8 conta). Break pulado não conta.
  - Pausa e cala só no `beforeAd`; volta no `afterAd`/`adBreakDone`.
- **Premiado** (`reward`): no "Continuar". O prêmio só sai com `adViewed`.
- **Idioma:** `getPlatformLocale()`, com inglês como padrão.
- **Foco:** perder o foco (`blur`) abre a pausa (`plataforma.pausaNoBlur`; a build do californiagames não liga).

## Convenções
- Código e comentários em português, comentários em ASCII. 2 espaços, aspas simples, ponto e vírgula. JSDoc no lugar de tipos.
- Fronteiras checadas por `test/estilo.test.js`:
  - `src/jogo/` sem three, DOM, `Math.random` nem relógio;
  - só `armazenamento.js` toca o `localStorage`;
  - só `depuracao.js` lê a URL;
  - sem `console.log`;
  - nenhuma URL externa.
- Mudou o gerador ou a física? Rode `npm test`. O teste do autopiloto (150 s × 8 sementes × 2 mapas, sem morrer nem trombar) prova que sempre há caminho.
- `personagem.atualizar` aceita `dt` 0 (pausa e prints) e ignora `dt` negativo (o primeiro quadro do rAF).

## Comandos
- `npm test`: node --test, cerca de 30 s.
- `npm run servir`: http://127.0.0.1:5420/. A vitrine fica em `/modelos/vitrine.html` e a arte do portal em `/tools/arte.html?tipo=thumb|capa`.
- **Parâmetros:** `?cenario=vila|rio&semente=N&auto&fixo&t=12&fps&qualidade=alta|media|baixa&novo&inv&lang=en&tela=fim`.
- `npm run californiagames`: testes e `tools/empacotar.mjs`.
  - Monta `dist-californiagames/`, com a tag `/sdk/v1/plataforma-sdk.js` antes do importmap e sem o atalho do laboratório.
  - Confere as regras e grava `run-run-sahur-californiagames-<versao>.zip` e `.sha256` em `../jogos/distribuicao/runrunsahur/californiagames/build/`.
- `npm run y8`: testes e `tools/empacotar.mjs --alvo=y8`.
  - Monta `dist-y8/` e grava `runrunsahur-y8-<versao>.zip` e `.sha256` em `../jogos/distribuicao/runrunsahur/y8/build/`.
- `npm run provar:y8`: serve o zip da Y8 numa porta livre e prova num Chrome headless (`tools/provar-y8.mjs`).
  - Com o SDK bloqueado (`MAP cdn.y8.com 127.0.0.1:9`) e com um SDK falso: ids, idioma, intersticial só no clique, pausa e mudo no `beforeAd`, prêmio com `adViewed`, 180 s e pausa no blur.
- `node tools/arte.mjs <pasta>`: thumb (1024²) e capa (1920×1080) feitas com o motor do jogo.
- **Prova, de `jogos/distribuicao/`:**
  - `node ferramentas/provar.mjs runrunsahur [--lang=en] [--largura=1920 --altura=1080] [--largura=540 --altura=960 --escala=2 --mobile]`, com o roteiro em `runrunsahur/californiagames/roteiro.mjs`;
  - `PREVIEW=1 ... --largura=960 --altura=540` grava `prova/preview.webm`;
  - `node ferramentas/conferir.mjs runrunsahur`.
- `npm run prints`: prints do laboratório (os da Fase 1).

## Pendências
- **FPS** ainda não medido numa GPU real nem num celular. A qualidade cai sozinha abaixo de 45 fps.
- **Draw calls:** cerca de 250 a 340 no "alta". Caminhos para reduzir: juntar as partes do personagem e reduzir os pontos de brilho por trecho.
- **three.js** vai sem minificar (cerca de 2,1 MB, 0,5 MB no zip).
