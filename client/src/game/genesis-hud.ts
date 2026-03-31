/**
 * Genesis Game HUD
 *
 * BabylonJS GUI overlay using Demonic_UI assets from the Unity project.
 * Renders: HP/MP/Stamina bars, skill hotbar, XP bar, target frame,
 * interaction prompt, minimap placeholder, combat log.
 *
 * Reads all state from GenesisGameBridge via observables.
 */

import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Image } from "@babylonjs/gui/2D/controls/image";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Scene } from "@babylonjs/core/scene";
import type { GenesisGameBridge, CharacterSnapshot, HotbarSlot } from "./genesis-game-bridge";

// ── UI asset paths ─────────────────────────────────────────────
const UI = "/assets/ui/demonic/";
const UI_ICONS = "/assets/ui/demonic/icons/";

// ── HUD Class ──────────────────────────────────────────────────

export class GenesisHUD {
  private adt: AdvancedDynamicTexture;
  private bridge: GenesisGameBridge;

  // Bar elements
  private hpFill!: Rectangle;
  private mpFill!: Rectangle;
  private staminaFill!: Rectangle;
  private hpText!: TextBlock;
  private mpText!: TextBlock;
  private xpFill!: Rectangle;
  private levelText!: TextBlock;
  private goldText!: TextBlock;

  // Hotbar
  private hotbarSlots: { bg: Rectangle; icon: Image | null; keyLabel: TextBlock; cdOverlay: Rectangle; cdText: TextBlock }[] = [];

  // Target frame
  private targetFrame!: Rectangle;
  private targetName!: TextBlock;
  private targetHpFill!: Rectangle;

  // Interaction prompt
  private interactPrompt!: Rectangle;
  private interactText!: TextBlock;

  // Player info
  private nameText!: TextBlock;

  constructor(scene: Scene, bridge: GenesisGameBridge) {
    this.bridge = bridge;
    this.adt = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);

    this.buildPlayerFrame();
    this.buildResourceBars();
    this.buildHotbar();
    this.buildXPBar();
    this.buildTargetFrame();
    this.buildInteractPrompt();

    // Subscribe to bridge events
    bridge.events.onStatsChanged.add(snap => this.updateStats(snap));
    bridge.events.onInteractionPrompt.add(data => {
      if (data) {
        this.interactPrompt.isVisible = true;
        this.interactText.text = `[E] ${data.name}`;
      } else {
        this.interactPrompt.isVisible = false;
      }
    });

    // Initial update
    this.updateStats(bridge.getSnapshot());
    this.updateHotbar(bridge.getHotbar());

    // Periodic hotbar update (cooldowns)
    scene.onBeforeRenderObservable.add(() => {
      this.updateHotbar(bridge.getHotbar());
    });
  }

  // ── Player info frame (top-left) ─────────────────────────────

  private buildPlayerFrame(): void {
    const frame = new Rectangle("playerFrame");
    frame.width = "240px"; frame.height = "70px";
    frame.left = "12px"; frame.top = "12px";
    frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    frame.background = "rgba(0,0,0,0.75)";
    frame.cornerRadius = 6;
    frame.thickness = 1;
    frame.color = "#c5a05960";
    this.adt.addControl(frame);

    this.nameText = new TextBlock("nameText", "");
    this.nameText.color = "#c5a059";
    this.nameText.fontSize = 13;
    this.nameText.fontFamily = "'Oxanium', monospace";
    this.nameText.top = "-14px";
    this.nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.nameText.paddingLeft = "10px";
    frame.addControl(this.nameText);

    this.levelText = new TextBlock("levelText", "");
    this.levelText.color = "#888";
    this.levelText.fontSize = 11;
    this.levelText.fontFamily = "'Oxanium', monospace";
    this.levelText.top = "4px";
    this.levelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.levelText.paddingLeft = "10px";
    frame.addControl(this.levelText);

    this.goldText = new TextBlock("goldText", "");
    this.goldText.color = "#f59e0b";
    this.goldText.fontSize = 11;
    this.goldText.fontFamily = "'Oxanium', monospace";
    this.goldText.top = "20px";
    this.goldText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.goldText.paddingLeft = "10px";
    frame.addControl(this.goldText);
  }

  // ── HP / MP / Stamina bars ───────────────────────────────────

  private buildResourceBars(): void {
    const barContainer = new StackPanel("bars");
    barContainer.width = "220px";
    barContainer.left = "265px";
    barContainer.top = "12px";
    barContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    barContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    barContainer.isVertical = true;
    this.adt.addControl(barContainer);

    // HP bar
    const { fill: hpF, text: hpT, container: hpC } = this.createBar("hp", "#ef4444", "#7f1d1d", 22);
    this.hpFill = hpF; this.hpText = hpT;
    barContainer.addControl(hpC);

    // MP bar
    const { fill: mpF, text: mpT, container: mpC } = this.createBar("mp", "#3b82f6", "#1e3a5f", 18);
    this.mpFill = mpF; this.mpText = mpT;
    barContainer.addControl(mpC);

    // Stamina bar
    const { fill: stF, container: stC } = this.createBar("sta", "#f59e0b", "#78350f", 10);
    this.staminaFill = stF;
    barContainer.addControl(stC);
  }

  private createBar(name: string, fillColor: string, bgColor: string, h: number): { fill: Rectangle; text: TextBlock; container: Rectangle } {
    const container = new Rectangle(`${name}Bar`);
    container.width = "220px"; container.height = `${h}px`;
    container.background = bgColor;
    container.cornerRadius = h / 2;
    container.thickness = 1;
    container.color = "#00000040";
    container.paddingBottom = "3px";

    const fill = new Rectangle(`${name}Fill`);
    fill.width = "100%"; fill.height = "100%";
    fill.background = fillColor;
    fill.cornerRadius = h / 2;
    fill.thickness = 0;
    fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.addControl(fill);

    const text = new TextBlock(`${name}Text`, "");
    text.color = "#fff";
    text.fontSize = Math.min(h - 4, 12);
    text.fontFamily = "'Oxanium', monospace";
    text.outlineWidth = 1;
    text.outlineColor = "#000";
    container.addControl(text);

    return { fill, text, container };
  }

  // ── Skill Hotbar (bottom center) ─────────────────────────────

  private buildHotbar(): void {
    const hotbarBg = new Rectangle("hotbarBg");
    hotbarBg.width = "440px"; hotbarBg.height = "60px";
    hotbarBg.top = "-16px";
    hotbarBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    hotbarBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    hotbarBg.background = "rgba(0,0,0,0.7)";
    hotbarBg.cornerRadius = 8;
    hotbarBg.thickness = 1;
    hotbarBg.color = "#c5a05940";
    this.adt.addControl(hotbarBg);

    const panel = new StackPanel("hotbarPanel");
    panel.isVertical = false;
    panel.width = "430px"; panel.height = "54px";
    hotbarBg.addControl(panel);

    // 9 slots: 1,2,3,4,5(empty),F,R,7,8
    const keys = ["1", "2", "3", "4", " ", "F", "R", "7", "8"];
    for (let i = 0; i < 9; i++) {
      const slot = new Rectangle(`slot${i}`);
      slot.width = "46px"; slot.height = "46px";
      slot.background = i === 4 ? "transparent" : "rgba(20,20,30,0.8)";
      slot.cornerRadius = 4;
      slot.thickness = i === 4 ? 0 : 1;
      slot.color = i < 4 ? "#ef4444" : i <= 6 ? "#8b5cf6" : "#22c55e";
      slot.paddingLeft = "2px"; slot.paddingRight = "2px";
      panel.addControl(slot);

      if (i === 4) {
        this.hotbarSlots.push({ bg: slot, icon: null, keyLabel: new TextBlock(), cdOverlay: new Rectangle(), cdText: new TextBlock() });
        continue;
      }

      // Key label
      const keyLabel = new TextBlock(`key${i}`, keys[i]);
      keyLabel.color = "#888";
      keyLabel.fontSize = 9;
      keyLabel.fontFamily = "'Oxanium', monospace";
      keyLabel.top = "-17px"; keyLabel.left = "-15px";
      keyLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      keyLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      slot.addControl(keyLabel);

      // Icon placeholder
      const icon = new Image(`icon${i}`, "");
      icon.width = "32px"; icon.height = "32px";
      icon.stretch = Image.STRETCH_UNIFORM;
      slot.addControl(icon);

      // Cooldown overlay
      const cdOverlay = new Rectangle(`cd${i}`);
      cdOverlay.width = "100%"; cdOverlay.height = "100%";
      cdOverlay.background = "rgba(0,0,0,0.6)";
      cdOverlay.thickness = 0;
      cdOverlay.isVisible = false;
      slot.addControl(cdOverlay);

      const cdText = new TextBlock(`cdT${i}`, "");
      cdText.color = "#fff";
      cdText.fontSize = 16;
      cdText.fontFamily = "'Oxanium', monospace";
      cdOverlay.addControl(cdText);

      this.hotbarSlots.push({ bg: slot, icon, keyLabel, cdOverlay, cdText });
    }
  }

  // ── XP Bar (very bottom) ─────────────────────────────────────

  private buildXPBar(): void {
    const xpBg = new Rectangle("xpBg");
    xpBg.width = "440px"; xpBg.height = "6px";
    xpBg.top = "-8px";
    xpBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    xpBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    xpBg.background = "#1a1a2e";
    xpBg.cornerRadius = 3;
    xpBg.thickness = 0;
    this.adt.addControl(xpBg);

    this.xpFill = new Rectangle("xpFill");
    this.xpFill.width = "0%"; this.xpFill.height = "100%";
    this.xpFill.background = "#22d3ee";
    this.xpFill.cornerRadius = 3;
    this.xpFill.thickness = 0;
    this.xpFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    xpBg.addControl(this.xpFill);
  }

  // ── Target Frame (top center) ────────────────────────────────

  private buildTargetFrame(): void {
    this.targetFrame = new Rectangle("targetFrame");
    this.targetFrame.width = "200px"; this.targetFrame.height = "40px";
    this.targetFrame.top = "12px";
    this.targetFrame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.targetFrame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.targetFrame.background = "rgba(0,0,0,0.7)";
    this.targetFrame.cornerRadius = 6;
    this.targetFrame.thickness = 1;
    this.targetFrame.color = "#ef444460";
    this.targetFrame.isVisible = false;
    this.adt.addControl(this.targetFrame);

    this.targetName = new TextBlock("targetName", "");
    this.targetName.color = "#ef4444";
    this.targetName.fontSize = 12;
    this.targetName.fontFamily = "'Oxanium', monospace";
    this.targetName.top = "-8px";
    this.targetFrame.addControl(this.targetName);

    const hpBg = new Rectangle("tgtHpBg");
    hpBg.width = "180px"; hpBg.height = "8px";
    hpBg.top = "10px";
    hpBg.background = "#7f1d1d";
    hpBg.cornerRadius = 4;
    hpBg.thickness = 0;
    this.targetFrame.addControl(hpBg);

    this.targetHpFill = new Rectangle("tgtHpFill");
    this.targetHpFill.width = "100%"; this.targetHpFill.height = "100%";
    this.targetHpFill.background = "#ef4444";
    this.targetHpFill.cornerRadius = 4;
    this.targetHpFill.thickness = 0;
    this.targetHpFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpBg.addControl(this.targetHpFill);
  }

  // ── Interaction prompt (center screen) ───────────────────────

  private buildInteractPrompt(): void {
    this.interactPrompt = new Rectangle("interactPrompt");
    this.interactPrompt.width = "200px"; this.interactPrompt.height = "36px";
    this.interactPrompt.top = "80px";
    this.interactPrompt.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.interactPrompt.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.interactPrompt.background = "rgba(0,0,0,0.7)";
    this.interactPrompt.cornerRadius = 6;
    this.interactPrompt.thickness = 1;
    this.interactPrompt.color = "#22d3ee40";
    this.interactPrompt.isVisible = false;
    this.adt.addControl(this.interactPrompt);

    this.interactText = new TextBlock("interactText", "");
    this.interactText.color = "#22d3ee";
    this.interactText.fontSize = 13;
    this.interactText.fontFamily = "'Oxanium', monospace";
    this.interactPrompt.addControl(this.interactText);
  }

  // ── Update methods ───────────────────────────────────────────

  private updateStats(snap: CharacterSnapshot): void {
    // Bars
    const hpPct = snap.maxHp > 0 ? snap.hp / snap.maxHp : 0;
    const mpPct = snap.maxMp > 0 ? snap.mp / snap.maxMp : 0;
    const staPct = snap.maxStamina > 0 ? snap.stamina / snap.maxStamina : 0;
    this.hpFill.width = `${Math.max(0, Math.min(100, hpPct * 100))}%`;
    this.mpFill.width = `${Math.max(0, Math.min(100, mpPct * 100))}%`;
    this.staminaFill.width = `${Math.max(0, Math.min(100, staPct * 100))}%`;
    this.hpText.text = `${Math.floor(snap.hp)} / ${snap.maxHp}`;
    this.mpText.text = `${Math.floor(snap.mp)} / ${snap.maxMp}`;

    // XP
    const xpPct = snap.xpToNext > 0 ? snap.xp / snap.xpToNext : 0;
    this.xpFill.width = `${Math.max(0, Math.min(100, xpPct * 100))}%`;

    // Player info
    this.nameText.text = `${snap.name}`;
    this.levelText.text = `${snap.race} ${snap.heroClass} · Lv${snap.level}`;
    this.goldText.text = `💰 ${snap.gold}`;
  }

  private updateHotbar(slots: HotbarSlot[]): void {
    for (let i = 0; i < slots.length && i < this.hotbarSlots.length; i++) {
      const slot = slots[i];
      const ui = this.hotbarSlots[i];
      if (!ui || !ui.icon) continue;

      // Icon
      if (slot.iconUrl) {
        ui.icon.source = slot.iconUrl;
        ui.icon.isVisible = true;
      } else {
        ui.icon.isVisible = false;
      }

      // Cooldown
      if (slot.cooldownRemaining > 0) {
        ui.cdOverlay.isVisible = true;
        ui.cdText.text = slot.cooldownRemaining.toFixed(1);
      } else {
        ui.cdOverlay.isVisible = false;
      }
    }
  }

  /** Show target frame for a targeted entity */
  showTarget(name: string, hp: number, maxHp: number): void {
    this.targetFrame.isVisible = true;
    this.targetName.text = name;
    const pct = maxHp > 0 ? hp / maxHp : 0;
    this.targetHpFill.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
  }

  hideTarget(): void {
    this.targetFrame.isVisible = false;
  }

  dispose(): void {
    this.adt.dispose();
  }
}
