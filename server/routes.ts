import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { gameResultSchema, type GameResult } from "@shared/schema";
import { HEROES, CLASS_ABILITIES, ITEMS } from "../client/src/game/types";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const MAP_DATA_DIR = join(process.cwd(), "data");
const MAP_DATA_PATH = join(MAP_DATA_DIR, "map-data.json");

const gameResults: GameResult[] = [];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/heroes", (_req, res) => {
    res.json(HEROES);
  });

  app.get("/api/heroes/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const hero = HEROES.find((h) => h.id === id);
    if (!hero) {
      return res.status(404).json({ error: "Hero not found" });
    }
    res.json(hero);
  });

  app.get("/api/abilities/:class", (req, res) => {
    const heroClass = req.params.class;
    const abilities = CLASS_ABILITIES[heroClass];
    if (!abilities) {
      return res.status(404).json({ error: "Class not found" });
    }
    res.json(abilities);
  });

  app.get("/api/items", (_req, res) => {
    res.json(ITEMS);
  });

  app.post("/api/game/results", (req, res) => {
    const parsed = gameResultSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result: GameResult = {
      ...parsed.data,
      id: randomUUID(),
      timestamp: Date.now(),
    };
    gameResults.push(result);
    res.status(201).json(result);
  });

  app.get("/api/game/results", (_req, res) => {
    res.json(gameResults);
  });

  // ── NPC Hero Persistence ──────────────────────────────────────

  const NPC_HEROES_PATH = join(MAP_DATA_DIR, "npc-heroes.json");

  app.get("/api/npc/heroes", (_req, res) => {
    try {
      if (existsSync(NPC_HEROES_PATH)) {
        res.type("json").send(readFileSync(NPC_HEROES_PATH, "utf-8"));
      } else {
        res.json([]);
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/npc/heroes", (req, res) => {
    try {
      const heroes = req.body;
      if (!Array.isArray(heroes)) return res.status(400).json({ error: "Expected array" });
      if (!existsSync(MAP_DATA_DIR)) mkdirSync(MAP_DATA_DIR, { recursive: true });
      writeFileSync(NPC_HEROES_PATH, JSON.stringify(heroes), "utf-8");
      res.json({ ok: true, count: heroes.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── NPC Chat (GPT) ─────────────────────────────────────────

  app.post("/api/npc/chat", async (req, res) => {
    try {
      const { heroId, playerMessage, context } = req.body;
      if (heroId == null || !playerMessage) {
        return res.status(400).json({ error: "heroId and playerMessage required" });
      }

      const hero = HEROES[heroId];
      if (!hero) return res.status(404).json({ error: "Hero not found" });

      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_KEY) {
        // Fallback: no API key — return a canned response
        const canned = [
          `${hero.quote}`,
          `I am ${hero.name}, ${hero.title}. What brings you here?`,
          `The ${hero.faction} stands strong. How can I help?`,
          `Watch yourself out there. These lands are dangerous.`,
          `Need something? I don't have all day.`,
        ];
        return res.json({ response: canned[Math.floor(Math.random() * canned.length)], source: 'fallback' });
      }

      // Build system prompt from hero codex data
      const systemPrompt = [
        `You are ${hero.name}, "${hero.title}".`,
        `Race: ${hero.race}. Class: ${hero.heroClass}. Faction: ${hero.faction}. Rarity: ${hero.rarity}.`,
        `Your famous quote: "${hero.quote}"`,
        `You are a living NPC hero in a fantasy MMO world called Grudge Warlords.`,
        `You are currently active in the world — fighting monsters, harvesting, and doing missions for your faction.`,
        context?.personality || '',
        context?.knowledge ? `Your faction knowledge: ${context.knowledge.join('. ')}` : '',
        context?.currentState ? `You are currently: ${context.currentState}` : '',
        context?.nearbyInfo ? `Nearby: ${context.nearbyInfo}` : '',
        `Respond in character. Keep responses under 3 sentences. Be conversational, not robotic.`,
        `If asked to do something (follow, trade, attack), respond with your willingness and add [ACTION:follow], [ACTION:trade], or [ACTION:attack] at the end.`,
      ].filter(Boolean).join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: playerMessage },
          ],
          max_tokens: 150,
          temperature: 0.9,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(502).json({ error: 'OpenAI error', details: err });
      }

      const data = await response.json() as any;
      const reply = data.choices?.[0]?.message?.content || 'I have nothing to say right now.';

      // Extract action triggers
      const actionMatch = reply.match(/\[ACTION:(\w+)\]/);
      const action = actionMatch ? actionMatch[1] : null;
      const cleanReply = reply.replace(/\[ACTION:\w+\]/g, '').trim();

      res.json({ response: cleanReply, action, source: 'gpt' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Map Admin API ─────────────────────────────────────────────

  app.get("/api/map", (_req, res) => {
    try {
      if (existsSync(MAP_DATA_PATH)) {
        const raw = readFileSync(MAP_DATA_PATH, "utf-8");
        res.type("json").send(raw);
      } else {
        res.status(404).json({ error: "No saved map" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/map", (req, res) => {
    try {
      const mapData = req.body;
      if (!mapData || !mapData.version || !mapData.terrain) {
        return res.status(400).json({ error: "Invalid map data" });
      }
      if (!existsSync(MAP_DATA_DIR)) mkdirSync(MAP_DATA_DIR, { recursive: true });
      writeFileSync(MAP_DATA_PATH, JSON.stringify(mapData), "utf-8");
      res.json({ ok: true, size: JSON.stringify(mapData).length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
