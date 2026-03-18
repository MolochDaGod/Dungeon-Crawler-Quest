/**
 * NpcDialog — modal overlay for NPC interactions
 * Tabs: Shop (buy/sell), Quests (accept/claim), Train (respec), Craft (recipes)
 */

import { useState, useMemo, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { OpenWorldState, OWHudState, NPCDialogTab, ActiveNPCDialog } from '@/game/open-world';
import { closeNPCDialog, acceptOWMission, claimOWMission } from '@/game/open-world';
import { getAvailableMissions, MissionDef } from '@/game/missions';
import {
  ShopItem, getOrCreateShop, buyItem, sellItem,
  sellPriceFor, getRespecCost, respecAttributes,
} from '@/game/npc-shops';
import { getAvailableRecipes, executeCraft, CraftingRecipe } from '@/game/crafting';
import { ATTRIBUTES, getAttr } from '@/game/attributes';
import { ISLAND_ZONES } from '@/game/zones';
import css from './NpcDialog.module.css';

// ── NPC Type Icons ────────────────────────────────────────────
const NPC_ICONS: Record<string, string> = {
  merchant: '🪙', quest: '📜', trainer: '📖', crafter: '🔨',
};

// ── Tabs per NPC type ─────────────────────────────────────────
const TABS_FOR_TYPE: Record<string, { id: NPCDialogTab; label: string }[]> = {
  merchant: [{ id: 'shop', label: 'Shop' }, { id: 'quests', label: 'Quests' }],
  quest:    [{ id: 'quests', label: 'Quests' }, { id: 'shop', label: 'Shop' }],
  trainer:  [{ id: 'train', label: 'Train' }, { id: 'quests', label: 'Quests' }],
  crafter:  [{ id: 'craft', label: 'Craft' }, { id: 'quests', label: 'Quests' }],
};

interface Props {
  activeNPC: ActiveNPCDialog;
  hud: OWHudState;
  stateRef: MutableRefObject<OpenWorldState | null>;
}

export default function NpcDialog({ activeNPC, hud, stateRef }: Props) {
  const { npc, tab: initialTab } = activeNPC;
  const [tab, setTab] = useState<NPCDialogTab>(initialTab);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender(n => n + 1), []);

  const tabs = TABS_FOR_TYPE[npc.type] || TABS_FOR_TYPE.quest;
  const zone = ISLAND_ZONES.find(z => z.id === npc.zoneId);
  const zoneName = zone?.name || 'Unknown';

  // Greeting text
  const greeting = useMemo(
    () => npc.dialogue[Math.floor(Math.random() * npc.dialogue.length)] || '',
    [npc.dialogue],
  );

  const handleClose = () => {
    if (stateRef.current) closeNPCDialog(stateRef.current);
  };

  return (
    <div className={css.overlay} onClick={handleClose}>
      <div className={css.dialog} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={css.header}>
          <div className={css.npcInfo}>
            <div className={css.npcIcon}>{NPC_ICONS[npc.type] || '👤'}</div>
            <div>
              <div className={css.npcName}>{npc.name}</div>
              <div className={css.npcZone}>{zoneName}</div>
            </div>
          </div>
          <button className={css.closeBtn} onClick={handleClose}>✕</button>
        </div>

        {/* Greeting */}
        {greeting && <div className={css.greeting}>"{greeting}"</div>}

        {/* Tab strip */}
        <div className={css.tabStrip}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={tab === t.id ? css.tabBtnActive : css.tabBtn}
              onClick={() => setTab(t.id)}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className={css.content}>
          {tab === 'shop' && <ShopTab npc={activeNPC} hud={hud} stateRef={stateRef} rerender={rerender} />}
          {tab === 'quests' && <QuestsTab npc={activeNPC} hud={hud} stateRef={stateRef} rerender={rerender} />}
          {tab === 'train' && <TrainTab hud={hud} stateRef={stateRef} rerender={rerender} />}
          {tab === 'craft' && <CraftTab hud={hud} stateRef={stateRef} rerender={rerender} />}
        </div>

        {/* Gold bar */}
        <div className={css.goldBar}>💰 {hud.gold}g</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// SHOP TAB
// ═════════════════════════════════════════════════════════════════

function ShopTab({ npc, hud, stateRef, rerender }: { npc: ActiveNPCDialog; hud: OWHudState; stateRef: MutableRefObject<OpenWorldState | null>; rerender: () => void }) {
  const state = stateRef.current;
  if (!state) return null;

  const shopItems = getOrCreateShop(npc.npc.zoneId, state.player.level);

  const handleBuy = (idx: number) => {
    if (!stateRef.current) return;
    buyItem(stateRef.current, shopItems, idx);
    rerender();
  };

  const handleSell = (itemId: string) => {
    if (!stateRef.current) return;
    sellItem(stateRef.current, itemId);
    rerender();
  };

  return (
    <>
      <div className={css.shopGrid}>
        {shopItems.map((si, idx) => (
          <div key={idx} className={`${css.shopItem} ${si.sold ? css.shopItemSold : ''}`}>
            <div className={css.shopItemIcon}>
              <span className={css.shopItemTier}>T{si.equipment.tier}</span>
            </div>
            <div className={css.shopItemInfo}>
              <div className={css.shopItemName}>{si.equipment.name}</div>
              <div className={css.shopItemStats}>
                {si.equipment.slot} · ATK {si.equipment.atk} · DEF {si.equipment.def}
              </div>
            </div>
            {!si.sold && (
              <button className={css.buyBtn} onClick={() => handleBuy(idx)}>
                {si.buyPrice}g
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Sell from bag */}
      {state.equipmentBag.items.length > 0 && (
        <div className={css.sellSection}>
          <div className={css.sellHeader}>Sell Items</div>
          <div className={css.sellGrid}>
            {state.equipmentBag.items.slice(0, 12).map(item => (
              <div key={item.id} className={css.sellItem} onClick={() => handleSell(item.id)}>
                <div className={css.sellItemName}>{item.name}</div>
                <div className={css.sellItemPrice}>{sellPriceFor(item)}g</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// QUESTS TAB
// ═════════════════════════════════════════════════════════════════

function QuestsTab({ npc, hud, stateRef, rerender }: { npc: ActiveNPCDialog; hud: OWHudState; stateRef: MutableRefObject<OpenWorldState | null>; rerender: () => void }) {
  const state = stateRef.current;
  if (!state) return null;

  const zoneId = npc.npc.zoneId;
  const available = getAvailableMissions(state.missionLog, zoneId, state.player.level);
  const active = state.missionLog.active.filter(m => m.def.zoneId === zoneId);

  const handleAccept = (id: string) => {
    if (!stateRef.current) return;
    acceptOWMission(stateRef.current, id);
    rerender();
  };

  const handleClaim = (id: string) => {
    if (!stateRef.current) return;
    claimOWMission(stateRef.current, id);
    rerender();
  };

  if (available.length === 0 && active.length === 0) {
    return <div className={css.emptyState}>No quests available here right now.</div>;
  }

  return (
    <>
      {/* Active missions in this zone */}
      {active.length > 0 && active.map(m => (
        <div key={m.def.id} className={css.questCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className={css.questTitle}>{m.def.name}</div>
            <span className={css.questStatus} style={{
              background: m.status === 'complete' ? 'rgba(34,197,94,.15)' : 'rgba(96,165,250,.15)',
              color: m.status === 'complete' ? '#22c55e' : '#60a5fa',
              border: `1px solid ${m.status === 'complete' ? '#22c55e50' : '#60a5fa50'}`,
            }}>{m.status === 'complete' ? 'COMPLETE' : 'ACTIVE'}</span>
          </div>
          <div className={css.questObjectives}>
            {m.objectives.map((o, oi) => (
              <div key={oi} className={css.questObj}>
                <span style={{ textTransform: 'capitalize' }}>{o.type}: {o.target}</span>
                <span style={{ color: o.current >= o.required ? '#22c55e' : '#f59e0b' }}>
                  {o.current}/{o.required}
                </span>
              </div>
            ))}
          </div>
          {m.status === 'complete' && (
            <button className={css.claimBtn} onClick={() => handleClaim(m.def.id)}>CLAIM REWARD</button>
          )}
        </div>
      ))}

      {/* Available missions */}
      {available.map((m: MissionDef) => (
        <div key={m.id} className={css.questCard}>
          <div className={css.questTitle}>{m.name}</div>
          <div className={css.questDesc}>{m.description}</div>
          <div className={css.questReward}>
            Reward: {m.reward.xp} XP, {m.reward.gold}g
            {m.reward.equipmentTier && <span style={{ color: '#a855f7' }}> + T{m.reward.equipmentTier} gear</span>}
          </div>
          <button className={css.acceptBtn} onClick={() => handleAccept(m.id)}>ACCEPT</button>
        </div>
      ))}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// TRAIN TAB
// ═════════════════════════════════════════════════════════════════

function TrainTab({ hud, stateRef, rerender }: { hud: OWHudState; stateRef: MutableRefObject<OpenWorldState | null>; rerender: () => void }) {
  const state = stateRef.current;
  if (!state) return null;

  const cost = getRespecCost(state.player.level);
  const canAfford = state.player.gold >= cost;

  const handleRespec = () => {
    if (!stateRef.current) return;
    respecAttributes(stateRef.current);
    rerender();
  };

  return (
    <div className={css.trainSection}>
      <div className={css.trainDesc}>
        Reset all attribute points and redistribute them freely.<br />
        All allocated points will be refunded.
      </div>
      <button className={css.respecBtn} disabled={!canAfford} onClick={handleRespec}>
        RESPEC ATTRIBUTES
      </button>
      <div className={css.respecCost}>
        Cost: {cost}g {!canAfford && <span style={{ color: '#ef4444' }}>(not enough gold)</span>}
      </div>

      {/* Current attribute preview */}
      <div className={css.attrPreview}>
        {ATTRIBUTES.map(attr => (
          <div key={attr.id} className={css.attrRow}>
            <span className={css.attrLabel}>{attr.emoji} {attr.short}</span>
            <span className={css.attrValue}>{getAttr(state.playerAttributes, attr.id as any)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: '#6b5535' }}>
        Unspent: <span style={{ color: '#6ec96e' }}>{state.playerAttributes.unspentPoints}</span> points
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// CRAFT TAB
// ═════════════════════════════════════════════════════════════════

const RECIPE_ICONS: Record<string, string> = {
  weapon: '⚔️', armor: '🛡️', consumable: '🧪', tool: '🔧',
};

function CraftTab({ hud, stateRef, rerender }: { hud: OWHudState; stateRef: MutableRefObject<OpenWorldState | null>; rerender: () => void }) {
  const state = stateRef.current;
  if (!state) return null;

  // Show recipes up to player's profession levels, limited to manageable count
  const recipes = getAvailableRecipes(state.playerProfessions, state.resourceInventory)
    .slice(0, 30);

  const handleCraft = (recipe: CraftingRecipe) => {
    if (!stateRef.current) return;
    const result = executeCraft(recipe, stateRef.current.resourceInventory, stateRef.current.playerProfessions);
    if (result.success) {
      stateRef.current.killFeed.push({
        text: `Crafted ${recipe.name}!`, color: '#f59e0b', time: stateRef.current.gameTime,
      });
      if (result.profLevelUp) {
        stateRef.current.killFeed.push({
          text: `${recipe.profession} leveled to ${result.profNewLevel}!`, color: '#ffd700', time: stateRef.current.gameTime,
        });
      }
    } else {
      stateRef.current.killFeed.push({
        text: result.reason || 'Cannot craft', color: '#ef4444', time: stateRef.current.gameTime,
      });
    }
    rerender();
  };

  if (recipes.length === 0) {
    return <div className={css.emptyState}>No recipes available at your profession level.</div>;
  }

  return (
    <>
      {recipes.map(({ recipe, craftable, reason }) => (
        <div key={recipe.id} className={`${css.recipeCard} ${!craftable ? css.recipeLocked : ''}`}>
          <div className={css.recipeIcon}>{RECIPE_ICONS[recipe.category] || '🔧'}</div>
          <div className={css.recipeInfo}>
            <div className={css.recipeName}>{recipe.name}</div>
            <div className={css.recipeDesc}>{recipe.description}</div>
            <div className={css.recipeMats}>
              {recipe.ingredients.map((ing, i) => (
                <span key={i}>{i > 0 && ', '}{ing.quantity}× {ing.name}</span>
              ))}
            </div>
          </div>
          <button
            className={css.craftBtn}
            disabled={!craftable}
            title={!craftable ? reason : 'Craft this item'}
            onClick={() => handleCraft(recipe)}
          >CRAFT</button>
        </div>
      ))}
    </>
  );
}
