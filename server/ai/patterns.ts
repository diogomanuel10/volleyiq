import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  DetectedPattern,
  PatternDetectionInput,
} from "@shared/types";

const AI_MOCK = process.env.AI_MOCK === "true" || !process.env.ANTHROPIC_API_KEY;

const patternSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(["serve", "attack", "rotation", "setter", "reception"]),
  confidence: z.number().int().min(0).max(100),
  evidence: z.string(),
  recommendation: z.string(),
});

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    patterns: {
      type: "array",
      description: "List of detected tactical patterns, 1 to 8 items",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique short identifier, e.g. 'p-serve-1'" },
          title: { type: "string", description: "Short title of the pattern (max 10 words)" },
          category: {
            type: "string",
            enum: ["serve", "attack", "rotation", "setter", "reception"],
          },
          confidence: {
            type: "integer",
            description: "Confidence level 0-100. Lower when sample is small.",
          },
          evidence: {
            type: "string",
            description: "One sentence citing concrete numbers from the data",
          },
          recommendation: {
            type: "string",
            description: "One actionable sentence for the opposing coach",
          },
        },
        required: ["id", "title", "category", "confidence", "evidence", "recommendation"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 8,
    },
  },
  required: ["patterns"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `És um analista de voleibol sénior. A partir dos dados estruturados do adversário, identifica padrões táticos recorrentes e escreve uma recomendação accionável para a equipa que o vai defrontar. Usa apenas os dados fornecidos — quando a evidência for fraca, reduz a confidence. Nunca inventes dados.`;

function buildUserPrompt(input: PatternDetectionInput) {
  return [
    `Adversário: ${input.opponent}`,
    `Tamanho de amostra (acções): ${input.sampleSize}`,
    "",
    "Serve targets (zona → nº):",
    JSON.stringify(input.serveTargets),
    "",
    "Distribuição de ataque por rotação (rotação → zona → nº):",
    JSON.stringify(input.attackByRotation),
    "",
    "Side-out % por rotação:",
    JSON.stringify(input.rotationSideOut),
    "",
    "Distribuição do distribuidor (posição → nº de sets):",
    JSON.stringify(input.setterDistribution),
  ].join("\n");
}

export async function detectPatterns(
  input: PatternDetectionInput,
): Promise<DetectedPattern[]> {
  if (AI_MOCK) return mockPatterns(input);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const resp = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "report_patterns",
        description: "Report all detected tactical patterns from the opponent dataset",
        input_schema: TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "report_patterns" },
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const toolBlock = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) throw new Error("AI: no tool_use block returned");

  const parsed = z
    .object({ patterns: z.array(patternSchema).min(1).max(8) })
    .parse(toolBlock.input);

  return parsed.patterns;
}

function mockPatterns(input: PatternDetectionInput): DetectedPattern[] {
  const topServeZone =
    Object.entries(input.serveTargets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "5";
  const weakestRotation =
    Object.entries(input.rotationSideOut).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "R1";
  const topSetterPos =
    Object.entries(input.setterDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "OH";

  return [
    {
      id: "p-serve",
      title: `Serviço concentrado na zona ${topServeZone}`,
      category: "serve",
      confidence: 82,
      evidence: `Em ${input.sampleSize} acções, a maior fatia de serviços foi para a zona ${topServeZone}.`,
      recommendation: `Prepara o passador dessa zona para serviço em suspensão e ajusta o recuo do OH que a cobre.`,
    },
    {
      id: "p-rotation",
      title: `Rotação ${weakestRotation} vulnerável em side-out`,
      category: "rotation",
      confidence: 71,
      evidence: `Side-out % mais baixo registado na rotação ${weakestRotation}.`,
      recommendation: `Força serviços agressivos quando o adversário chegar a ${weakestRotation}; considera time-out tático se conseguires 2 pontos seguidos.`,
    },
    {
      id: "p-setter",
      title: `Distribuidor prefere posição ${topSetterPos}`,
      category: "setter",
      confidence: 64,
      evidence: `A posição ${topSetterPos} recebeu mais sets do que qualquer outra em situação neutra.`,
      recommendation: `Define um duplo bloco escalonado sobre o ${topSetterPos} quando o passe for de qualidade boa ou perfeita.`,
    },
  ];
}
