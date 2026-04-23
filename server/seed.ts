import { db } from "./db";
import { nanoid } from "nanoid";
import {
  teams,
  memberships,
  players,
  matches,
  checklistItems,
} from "@shared/schema";

/**
 * Popula o SQLite com uma equipa demo, 12 jogadores, 3 jogos e uma checklist
 * típica de dia-de-jogo. Idempotente: apaga dados da equipa demo antes de inserir.
 */

const DEMO_UID = "dev-user";
const DEMO_TEAM_ID = "team-demo";

async function seed() {
  console.log("[seed] limpar dados demo…");
  await db.delete(teams); // cascade cuida do resto

  console.log("[seed] criar equipa demo");
  await db.insert(teams).values({
    id: DEMO_TEAM_ID,
    name: "VolleyIQ FC",
    club: "CD VolleyIQ",
    category: "Seniores Femininas",
    season: "2025/26",
    division: "Divisão A1",
    primaryColor: "#0ea5e9",
    plan: "pro",
    ownerUid: DEMO_UID,
  });
  await db.insert(memberships).values({
    id: nanoid(12),
    teamId: DEMO_TEAM_ID,
    uid: DEMO_UID,
    role: "owner",
  });

  console.log("[seed] jogadores");
  const roster: Array<{ n: number; fn: string; ln: string; pos: any }> = [
    { n: 1, fn: "Rita", ln: "Almeida", pos: "L" },
    { n: 3, fn: "Sofia", ln: "Costa", pos: "S" },
    { n: 5, fn: "Inês", ln: "Ferreira", pos: "OH" },
    { n: 6, fn: "Mariana", ln: "Gonçalves", pos: "OH" },
    { n: 8, fn: "Beatriz", ln: "Lopes", pos: "MB" },
    { n: 9, fn: "Carolina", ln: "Martins", pos: "MB" },
    { n: 10, fn: "Ana", ln: "Nunes", pos: "OPP" },
    { n: 11, fn: "Joana", ln: "Oliveira", pos: "DS" },
    { n: 12, fn: "Teresa", ln: "Pereira", pos: "OH" },
    { n: 14, fn: "Margarida", ln: "Ribeiro", pos: "S" },
    { n: 15, fn: "Luísa", ln: "Santos", pos: "MB" },
    { n: 17, fn: "Filipa", ln: "Vaz", pos: "OPP" },
  ];
  for (const p of roster) {
    await db.insert(players).values({
      id: nanoid(12),
      teamId: DEMO_TEAM_ID,
      firstName: p.fn,
      lastName: p.ln,
      number: p.n,
      position: p.pos,
      active: true,
    });
  }

  console.log("[seed] jogos");
  const opponents = ["Porto VC", "Benfica", "Leixões"];
  for (let i = 0; i < opponents.length; i++) {
    const id = nanoid(12);
    await db.insert(matches).values({
      id,
      teamId: DEMO_TEAM_ID,
      opponent: opponents[i],
      date: new Date(Date.now() - (i + 1) * 7 * 86400_000),
      venue: i % 2 === 0 ? "home" : "away",
      competition: "Liga",
      setsWon: i === 0 ? 3 : 2,
      setsLost: i === 0 ? 1 : 3,
      status: "finished",
    });
    if (i === 0) {
      // Checklist completa para o próximo jogo
      const items = [
        { cat: "lineup", lbl: "Lineup inicial definido" },
        { cat: "lineup", lbl: "Substitutos identificados" },
        { cat: "scouting", lbl: "Padrões do adversário revistos" },
        { cat: "scouting", lbl: "Vídeo dos últimos 2 jogos visto" },
        { cat: "scouting", lbl: "Serviços-alvo marcados" },
        { cat: "tactical", lbl: "Plano para rotação fraca definido" },
        { cat: "tactical", lbl: "Sinais de bloco acordados" },
        { cat: "tactical", lbl: "Plano de time-outs" },
        { cat: "logistics", lbl: "Transporte confirmado" },
        { cat: "logistics", lbl: "Equipamento carregado" },
        { cat: "logistics", lbl: "Hidratação e lanches" },
      ] as const;
      for (let j = 0; j < items.length; j++) {
        await db.insert(checklistItems).values({
          id: nanoid(12),
          matchId: id,
          category: items[j].cat,
          label: items[j].lbl,
          done: false,
          order: j,
        });
      }
    }
  }

  console.log("[seed] done ✔");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
