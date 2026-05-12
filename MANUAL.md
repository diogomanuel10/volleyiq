# VolleyIQ — Manual do Treinador

Bem-vindo ao **VolleyIQ**. Este manual mostra, passo a passo, como tirar
o máximo da plataforma — desde o primeiro login até à análise pós-jogo.

> **Tempo de leitura:** ~15 min · **Tempo até primeiro jogo registado:** < 30 min.

---

## 1. Primeiro acesso (< 5 min)

1. Abre **https://volley-iq.vercel.app** no browser (Chrome, Edge ou Safari
   recentes). Em tablet ou telemóvel, podes instalar como app: menu do
   browser → **"Instalar app"** / **"Adicionar ao ecrã principal"**.
2. Faz **registo** com email e palavra-passe ou entra com **Google**.
3. À primeira entrada, o **Setup Guide** acompanha-te nos próximos passos.

> **Dica:** o login com Google é mais rápido e não precisa de gerir
> palavras-passe.

---

## 2. Criar a tua equipa (5 min)

No **Setup Guide** (ou em `Definições → Equipa`):

1. **Nome da equipa**, escalão (sénior, sub-19, etc.) e época.
2. **Adicionar jogadores** — duas formas:
   - **Manual:** nome, número, posição, mão dominante.
   - **Import Excel:** carrega um `.xlsx` com colunas
     `numero, nome, posicao, mao` (vê o exemplo no diálogo de import).
3. **Líberos** — marca quais os jogadores que são líberos (afeta a
   rotação automática no Live Scout).

### Partilhar a equipa com o staff

Em `Definições → Equipa → Convidar` é gerado um **código de convite**.
Partilha-o com adjuntos / analistas. Eles registam-se em VolleyIQ,
introduzem o código e ficam com acesso à mesma equipa.

---

## 3. Antes do jogo (10 min)

### 3.1. Criar o jogo

`Jogos → Novo jogo`:

- Adversário (cria em `Adversários` se ainda não existir).
- Data, hora, local, casa/fora.
- Tipo de scout:
  - **Apenas a minha equipa** — mais rápido, foca‑te nas tuas ações.
  - **Ambas as equipas (dual scout)** — recolhe stats completos do
    adversário.
  - **Observação** — só observas, não há equipa “casa”.

### 3.2. Plano tático

Em `Match Day` ou `Scouting Report`:

- Vê o **relatório do adversário** gerado por IA (forças, fraquezas,
  jogadoras-chave, padrões de saque/ataque).
- Define **rotações iniciais** e **substituições previstas**.
- Notas livres do staff técnico.

---

## 4. Live Scout — durante o jogo

Esta é a página onde vais passar mais tempo. **Funciona melhor em tablet**
horizontal, mas adapta-se a telemóvel.

### 4.1. Antes de começar

1. Entra em `Jogos → o teu jogo → Live Scout` (ou `/scout`).
2. **Lineup Wizard** — escolhe os 6 iniciais e a posição em campo (P1 a P6).
3. Confirma o líbero e quem ele substitui.

### 4.2. Registar ações

Cada ação demora **2 toques**:

1. **Toca no jogador** que executou (no campo ou na lista).
2. **Escolhe o tipo de ação** na barra inferior:
   - **Saque** (S): ace, erro, em jogo.
   - **Receção** (R): perfeita, boa, má, erro.
   - **Ataque** (A): ponto, bloqueado, erro, em jogo.
   - **Bloco** (B): ponto, toque, erro.
   - **Defesa** (D): boa, má.
3. Para **ataque e bloco**, podes tocar no campo adversário para marcar
   **onde caiu a bola** (heatmap automático).

> **Atalhos de teclado** (desktop): `S`, `R`, `A`, `B`, `D` para tipo,
> `1`-`4` para resultado, `Z` para anular última ação. Vê todos em
> `?` ou no botão de ajuda do canto.

### 4.3. Rotação e líbero

- A rotação atualiza-se automaticamente quando a tua equipa **ganha
  serviço**.
- O líbero entra/sai automaticamente quando o MB vai para a zona 1
  (receção). Aparece com **contorno amarelo tracejado** em campo.

### 4.4. Substituições

`Banco → Substituir`. A app **sugere substituições** em tempo real
(painel "Sugestões"), com base no rendimento da rotação atual.

### 4.5. Painel de sugestões em tempo real

À direita do campo, o **painel de sugestões** mostra:

- Padrões observados ("o adversário ataca 70% pela ponta esquerda").
- Recomendações de bloqueio.
- Jogadores cansados / com queda de rendimento.
- Substituições aconselhadas.

### 4.6. Second Screen (banco)

Em `/second-screen/<matchId>` abre uma vista simplificada **para o tablet
do banco**: marcador grande, rotação atual e últimas ações. Não precisa
de input — só visualização.

---

## 5. Depois do jogo

### 5.1. Post-Match

`Pós-jogo`:

- **Estatísticas agregadas** por jogador, set e fase do rally.
- **Heatmaps** de ataque, saque e receção.
- **Análise por IA** — pontos fortes, fracos e recomendações.
- **Export para Excel** (botão no topo).

### 5.2. Player Detail

`Jogadoras → <nome>`:

- Evolução ao longo da época (eficiência, % positiva, %#perfeita).
- Comparação com média da equipa.
- Histórico de ações por jogo.

### 5.3. Dashboard

Página inicial: KPIs da equipa, próximos jogos, jogadores em destaque
e alertas (lesões reportadas, queda de rendimento).

---

## 6. Análise tática contínua

- **Scenario** (`/scenario`) — simula situações: "se trocar X por Y na
  rotação 3, como muda o side-out?".
- **Scouting Report** — gera ficha de qualquer adversário (precisa de
  pelo menos 1 jogo registado contra ele).
- **Import DVW** — se tens jogos antigos em formato DataVolley (`.dvw`),
  importa em `Jogos → Importar DVW`.

---

## 7. FAQ rápido

**Esqueci-me da palavra-passe.**
Em `Login → Esqueci-me da palavra-passe` (ou usa Google).

**Posso ter mais que uma equipa?**
Para já, uma conta = uma equipa. Para gerir várias equipas, usa contas
separadas ou contacta o suporte.

**Os dados ficam guardados na cloud?**
Sim — base de dados em Postgres (Railway), auth em Firebase. Backups
diários.

**Funciona offline?**
O Live Scout precisa de ligação à internet para sincronizar. Estamos
a trabalhar em modo offline para versões futuras.

**Como anulo uma ação errada?**
`Z` no teclado, ou botão **Anular** no log de ações (canto inferior).

**O Google login não está a funcionar.**
Provavelmente o teu domínio não está autorizado no Firebase. Avisa o
admin para adicionar em *Firebase Console → Authentication → Settings →
Authorized domains*.

---

## 8. Boas práticas

- **Scout durante o jogo, não depois.** A app foi pensada para registo
  em tempo real — perde-se contexto se for à posteriori.
- **Usa dual-scout sempre que possível** — dobra a quantidade de dados
  e melhora muito as sugestões.
- **Revê o Post-Match com a equipa** logo após o jogo (heatmaps são
  ótimos para feedback visual).
- **Mantém o plantel atualizado** — jogadoras suspensas/lesionadas
  marcadas como inativas em `Jogadoras` para sairem das sugestões.

---

## 9. Suporte

Dúvidas ou bugs? Abre uma issue em
https://github.com/diogomanuel10/VolleyIQ/issues ou contacta o admin
da tua equipa.

**Bons jogos! 🏐**
