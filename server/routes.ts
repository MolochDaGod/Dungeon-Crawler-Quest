import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { gameResultSchema, type GameResult } from "@shared/schema";
import { HEROES, CLASS_ABILITIES, ITEMS } from "../client/src/game/types";
import { randomUUID } from "crypto";

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

  return httpServer;
}
