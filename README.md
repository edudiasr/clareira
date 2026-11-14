# Clareira

Jogo de estratégia no navegador: você constrói uma vila numa clareira no meio da floresta e
defende o lugar das ondas de mercenários da **Companhia Serra Grande**, que querem derrubar a mata
inteira.

Visão isométrica 2D desenhada toda em código no Canvas, sem nenhuma imagem pronta. Feito em
JavaScript puro, sem framework e sem etapa de build.

## Como funciona

- **Recursos:** madeira (serraria), pedra (pedreira), ferro (mina, só em cima de veio de ferro) e
  moedas (mercado). Os depósitos aumentam o limite guardado.
- **A clareira cresce derrubando a mata.** Cortar árvores das bordas abre espaço e rende madeira.
  Quanto maior o nível do QG, mais longe dá para ir.
- **QG do nível 1 ao 8.** Cada nível libera prédios e defesas novas, e nenhum prédio passa do nível do QG.
- **Construtores:** são dois, e o Barracão dá mais um. Obras levam de segundos a poucos minutos.
- **Defesas:**

  | Defesa | Como funciona |
  |---|---|
  | Torre de atiradores | Rápida, acerta tropas e helicópteros |
  | Canhão | Dano alto, só no chão |
  | Morteiro | Dano em área de longe, mas não acerta quem está colado nele |
  | Tesla | Raio que pula entre inimigos |
  | Muros | Seguram e desviam as tropas |
  | Minas | Explodem uma vez e depois precisam ser rearmadas |

- **Ondas a cada 15 minutos**, saindo da mata por lados sorteados. Na batalha você só assiste:
  a estratégia toda está na montagem da base. A cada 5 ondas vem um chefe, que alterna entre a
  Colheitadeira Gigante e o Helicóptero da Companhia.
- **Inimigos:**

  | Inimigo | Como ataca |
  |---|---|
  | Fuzileiro | Ataca o que estiver mais perto |
  | Lenhador de motosserra | Corta muros rápido |
  | Motoqueiro | Vai direto nos prédios de recurso |
  | Bazuqueiro | Mira nas defesas |
  | Engenheiro | Desliga as defesas por alguns segundos |
  | Trator blindado | Lento e muito resistente |

- **Torre de vigia:** avisa minutos antes de qual lado a próxima onda vai sair.
- **Se o QG cair:** os mercenários levam 30% dos recursos e o que foi destruído fica em ruínas até
  ser reparado. A vila nunca é perdida.
- **Jogo fechado:** a produção e as obras continuam. Ao voltar, o jogo **simula as ondas que
  aconteceram** no horário em que caíram e mostra o relatório.
- **Antecipar a onda:** dá para chamar a próxima onda antes da hora e ganhar 25% a mais de recompensa.
- **Objetivos:** uma lista guia o começo do jogo e dá prêmios.

## Por dentro

A lógica não depende da tela. A batalha é uma simulação em passos de tempo fixos. A mesma função
roda ao vivo, com a cena desenhando os eventos (tiros, explosões, raios), e "às cegas" quando o jogo
precisa resolver as ondas que aconteceram com ele fechado.

- **Caminho das tropas:** usa A* na grade. Elas desviam de prédios e atravessam a mata mais devagar.
  Também decidem entre contornar um muro ou quebrar, comparando o custo de cada caminho.
- **Sorteios com semente:** o mapa e cada onda são sempre iguais para a mesma semente. Por isso
  a torre de vigia consegue mostrar a onda antes, e os testes conseguem conferir a batalha inteira.
- **Tempo real:** obras e produção usam horário real (timestamps), então nada para quando a aba fecha.

```
index.html, estilo.css
js/
  config.js     números do jogo: prédios, defesas, inimigos, custos
  aleatorio.js  sorteio com semente (mulberry32)
  mapa.js       terreno, ocupação, regras de construção e de corte
  economia.js   custo/tempo/vida por nível, produção, limites
  caminho.js    A* com fila de prioridade (heap)
  ondas.js      composição de cada onda
  combate.js    simulação da batalha
  jogo.js       estado, ações do jogador, tempo offline, objetivos, salvar
  desenho.js    projeção isométrica e formas (caixa, telhado, cilindro)
  sprites.js    terreno, árvores, prédios, tropas
  cena.js       câmera, ordem de desenho, efeitos e partículas
  som.js        efeitos sonoros sintetizados (Web Audio)
  ui.js, main.js  interface e loop do jogo
tests/          22 testes da lógica (node --test)
```

## Rodando

Precisa de um servidor local, porque os módulos ES não carregam via `file://`:

```bash
python -m http.server 8000
```

Depois, abra http://localhost:8000.

Para rodar os testes (Node 20 ou mais novo):

```bash
npm test
```

Os testes conferem:

- custos e limites por nível de QG;
- o mapa gerado com semente;
- as regras de construção e de corte da mata;
- o desvio de obstáculos do A*;
- a composição das ondas e os chefes;
- obras, construtores e produção ao longo do tempo;
- derrota (perda de 30% e reparo);
- a vitória de torres contra a primeira onda;
- que a batalha é determinística;
- a explosão das minas;
- as ondas simuladas com o jogo fechado;
- os objetivos;
- salvar e carregar.

## Controles

- Arraste para andar pelo mapa. A roda do mouse ou a pinça com dois dedos faz o zoom.
- Toque num prédio para ver os detalhes, melhorar ou mover. Toque na mata para derrubar e numa rocha para quebrar.
- **Construir** (ou a tecla `B`) abre a loja. No computador, o prédio segue o mouse e o clique confirma.

Licença MIT.
