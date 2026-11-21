# Run Run Sahur: laboratório de modelos (Fase 1)

Precisa do servidor: rode `npm run servir` e abra http://127.0.0.1:5420/modelos/laboratorio.html. Os módulos ES não carregam por `file://`.

- **A grade:** 2 cenários × 2 personagens, no estilo 3D de brinquedo. Cada célula mostra:
  - o print em paisagem (1280×720);
  - o print no celular em pé (390×844);
  - clicando, também a tela de início.
- **Jogar** abre `index.html?cenario=..&personagem=..&lab&novo`. **Autopiloto** soma `&auto`.
- **Escolher** marca a célula, e **Gravar escolha** escreve `docs/decisao.md`, com a nota opcional.
- **Vitrine** (`vitrine.html`): P1 e P2 lado a lado num giradouro, com um botão para cada animação.
- **Prints:** `npm run prints` refaz tudo em `modelos/prints/` (leva alguns minutos, porque o WebGL roda no SwiftShader).

## Modelos

| | P1 · Fiel ao meme | P2 · Chibi de jogo |
|---|---|---|
| **Vila do Sahur** (noite → amanhecer; carrinhos, becak na contramão, barracas com rampa; galo gigante) | `vila-p1` | `vila-p2` |
| **Rio de toras** (manhã; vãos de água, serras, troncos, balsas de toras; castor gigante) | `rio-p1` | `rio-p2` |

## Comparação

| | A favor | Contra |
|---|---|---|
| **Vila** | Tem a ver com o meme (o chamado do sahur antes do amanhecer). Lanternas e janelas acesas dão clima, e o amanhecer como progressão tem sentido. | A cena noturna pede cuidado com o contraste. A rua lembra mais o gênero. Não tem vão. |
| **Rio** | O trocadilho de um tronco correndo sobre troncos. O vão de água é uma mecânica a mais. Claro e colorido, e não lembra o Subway em nada. | Ligação menor com o "sahur". A água e as toras instanciadas custam mais GPU. O castor é menos icônico. |
| **P1** | É a silhueta que as pessoas reconhecem. | De costas, no celular em pé, vira um palito. Os membros finos somem. |
| **P2** | Lê melhor de costas e no retrato, e é mais expressivo. | Fica menos parecido com o meme. |

**Recomendação:** Vila + P1 como base (com membros e taco um pouco mais grossos), e o Rio como segundo mundo, ao qual o amanhecer leva.
