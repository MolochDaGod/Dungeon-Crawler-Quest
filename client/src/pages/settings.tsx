import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  KeybindAction, KeybindConfig, KeyBind,
  ACTION_CATEGORIES, ACTION_LABELS,
  loadKeybindings, saveKeybindings, resetKeybindings,
  keyBindLabel,
} from '@/game/keybindings';

interface GraphicsSettings {
  particleQuality: 'low' | 'medium' | 'high';
  screenShake: boolean;
  minimapSize: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  showDebugOverlay: boolean;
  showDamageNumbers: boolean;
}

const GRAPHICS_STORAGE_KEY = 'grudge_graphics_settings';

function loadGraphicsSettings(): GraphicsSettings {
  try {
    const stored = localStorage.getItem(GRAPHICS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      localStorage.setItem('grudge_volume', String(parsed.masterVolume ?? 50));
      return parsed;
    }
  } catch {}
  const defaults = { particleQuality: 'medium' as const, screenShake: true, minimapSize: 200, masterVolume: 50, sfxVolume: 100, musicVolume: 60, showDebugOverlay: false, showDamageNumbers: true };
  localStorage.setItem('grudge_volume', String(defaults.masterVolume));
  return defaults;
}

function saveGraphicsSettings(settings: GraphicsSettings): void {
  localStorage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(settings));
  localStorage.setItem('grudge_volume', String(settings.masterVolume));
}

const MOBA_CATEGORIES = ['Movement', 'MOBA Combat', 'MOBA Abilities (Q/W/E/R)', 'Level Up', 'Items', 'Camera', 'UI'];
const OW_CATEGORIES = ['Movement', 'Dungeon/OW Combat', 'Dungeon/OW Abilities (1-4)', 'Interaction', 'Items', 'Camera', 'UI'];

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [bindings, setBindings] = useState<KeybindConfig>(loadKeybindings);
  const [rebinding, setRebinding] = useState<KeybindAction | null>(null);
  const [modeTab, setModeTab] = useState<'moba' | 'openworld' | 'all'>('openworld');
  const [graphics, setGraphics] = useState<GraphicsSettings>(loadGraphicsSettings);

  const handleRebind = useCallback((action: KeybindAction) => {
    setRebinding(action);
  }, []);

  useEffect(() => {
    if (!rebinding) return;

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRebinding(null);
        return;
      }
      const newBind: KeyBind = {
        key: e.key.toLowerCase(),
        isMouseButton: false,
        mouseButton: -1,
        modifiers: { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey },
      };
      if (['shift', 'control', 'alt', 'meta'].includes(e.key.toLowerCase())) return;

      const updated = { ...bindings, [rebinding]: newBind };
      setBindings(updated);
      saveKeybindings(updated);
      setRebinding(null);
    };

    const onMouse = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const newBind: KeyBind = {
        key: '',
        isMouseButton: true,
        mouseButton: e.button,
        modifiers: { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey },
      };
      const updated = { ...bindings, [rebinding]: newBind };
      setBindings(updated);
      saveKeybindings(updated);
      setRebinding(null);
    };

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
    };
  }, [rebinding, bindings]);

  const handleReset = () => {
    const defaults = resetKeybindings();
    setBindings(defaults);
  };

  const updateGraphics = (patch: Partial<GraphicsSettings>) => {
    const updated = { ...graphics, ...patch };
    setGraphics(updated);
    saveGraphicsSettings(updated);
  };

  const filteredCategories = modeTab === 'moba' ? MOBA_CATEGORIES : modeTab === 'openworld' ? OW_CATEGORIES : Object.keys(ACTION_CATEGORIES);

  return (
    <div
      className="min-h-screen flex flex-col items-center py-8 px-4"
      style={{
        background: 'linear-gradient(135deg, #0a0f0a 0%, #12100a 50%, #0a0a12 100%)',
        fontFamily: "'Oxanium', sans-serif",
      }}
      data-testid="settings-page"
    >
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1
            className="text-3xl font-black tracking-wider"
            style={{ color: '#c5a059', textShadow: '0 0 20px rgba(197,160,89,0.3)' }}
            data-testid="text-settings-title"
          >
            SETTINGS
          </h1>
          <button
            className="px-4 py-2 text-sm font-bold rounded border cursor-pointer transition-all"
            style={{ borderColor: 'rgba(197,160,89,0.4)', color: '#c5a059', background: 'transparent' }}
            onClick={() => setLocation('/')}
            data-testid="button-back"
          >
            BACK
          </button>
        </div>

        <div className="flex mb-6" style={{ gap: 0 }} data-testid="panel-mode-tabs">
          {([['openworld', 'Open World'], ['moba', 'MOBA Arena'], ['all', 'All Controls']] as const).map(([mode, label]) => (
            <button
              key={mode}
              className="flex-1 py-3 text-sm font-bold uppercase tracking-wider cursor-pointer transition-all"
              style={{
                background: modeTab === mode
                  ? 'linear-gradient(to bottom, rgba(197,160,89,0.15), rgba(197,160,89,0.05))'
                  : 'linear-gradient(to bottom, rgba(10,15,10,0.8), rgba(10,10,10,0.8))',
                borderBottom: modeTab === mode ? '2px solid #c5a059' : '2px solid rgba(197,160,89,0.15)',
                borderTop: modeTab === mode ? '1px solid rgba(197,160,89,0.3)' : '1px solid rgba(197,160,89,0.08)',
                borderLeft: '1px solid rgba(197,160,89,0.08)',
                borderRight: '1px solid rgba(197,160,89,0.08)',
                color: modeTab === mode ? '#c5a059' : '#666',
                borderRadius: '6px 6px 0 0',
              }}
              onClick={() => setModeTab(mode)}
              data-testid={`button-tab-${mode}`}
            >
              {label}
            </button>
          ))}
        </div>

        {rebinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" data-testid="panel-rebind-overlay">
            <div
              className="p-8 text-center rounded-lg"
              style={{ background: 'linear-gradient(to bottom, #1a1a2e, #0a0a15)', border: '2px solid #c5a059' }}
            >
              <p className="text-lg text-[#c5a059] mb-2">Press a key or click a mouse button</p>
              <p className="text-sm text-gray-500">Binding: {ACTION_LABELS[rebinding]}</p>
              <p className="text-xs text-gray-600 mt-3">Press ESC to cancel</p>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h2
            className="text-xs uppercase tracking-[0.2em] mb-3"
            style={{ color: '#c5a059', textShadow: '0 0 8px rgba(197,160,89,0.2)' }}
          >
            Keybindings
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(ACTION_CATEGORIES)
            .filter(([category]) => filteredCategories.includes(category))
            .map(([category, actions]) => (
            <div
              key={category}
              className="rounded-md overflow-hidden"
              style={{
                background: 'linear-gradient(to bottom, rgba(15,18,15,0.95), rgba(10,12,10,0.95))',
                border: '1px solid rgba(197,160,89,0.2)',
              }}
            >
              <div
                className="px-4 py-2.5 text-xs font-bold tracking-wider uppercase"
                style={{ color: '#c5a059', background: 'rgba(197,160,89,0.06)', borderBottom: '1px solid rgba(197,160,89,0.15)' }}
              >
                {category}
              </div>
              <div>
                {actions.map((action, idx) => (
                  <div
                    key={action}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      borderBottom: idx < actions.length - 1 ? '1px solid rgba(197,160,89,0.06)' : 'none',
                    }}
                  >
                    <span className="text-sm text-gray-300">{ACTION_LABELS[action]}</span>
                    <button
                      className={`px-3 py-1 text-sm font-mono rounded transition-all cursor-pointer min-w-[80px] text-center ${
                        rebinding === action
                          ? 'animate-pulse'
                          : ''
                      }`}
                      style={{
                        background: rebinding === action ? 'rgba(197,160,89,0.2)' : 'rgba(30,30,30,0.6)',
                        border: rebinding === action ? '1px solid #c5a059' : '1px solid rgba(197,160,89,0.15)',
                        color: rebinding === action ? '#c5a059' : '#999',
                      }}
                      onClick={() => handleRebind(action)}
                      data-testid={`button-rebind-${action}`}
                    >
                      {rebinding === action ? '...' : keyBindLabel(bindings[action])}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3 justify-center">
          <button
            className="px-6 py-2.5 rounded-md font-bold text-sm cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(127,29,29,0.5), rgba(153,27,27,0.4))',
              border: '1px solid rgba(185,28,28,0.3)',
              color: '#f87171',
            }}
            onClick={handleReset}
            data-testid="button-reset-defaults"
          >
            RESET TO DEFAULTS
          </button>
        </div>

        <div className="mt-8 text-center mb-10">
          <p className="text-xs text-gray-600">Click any binding to rebind it. Press the new key or mouse button.</p>
          <p className="text-xs text-gray-600 mt-1">Mouse buttons: Left Click (LMB), Right Click (RMB), Middle Click (MMB)</p>
        </div>

        <div
          className="rounded-md overflow-hidden mb-8"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,18,15,0.95), rgba(10,12,10,0.95))',
            border: '1px solid rgba(197,160,89,0.2)',
          }}
          data-testid="panel-graphics"
        >
          <div
            className="px-4 py-2.5 text-xs font-bold tracking-wider uppercase"
            style={{ color: '#c5a059', background: 'rgba(197,160,89,0.06)', borderBottom: '1px solid rgba(197,160,89,0.15)' }}
          >
            Graphics
          </div>

          <div className="px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-sm text-gray-300 block">Particle Quality</span>
                <span className="text-xs text-gray-600">Affects spell and combat particle effects</span>
              </div>
              <div className="flex" style={{ gap: 0 }}>
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    className="px-4 py-1.5 text-xs font-bold uppercase cursor-pointer transition-all"
                    style={{
                      background: graphics.particleQuality === level
                        ? 'rgba(197,160,89,0.2)'
                        : 'rgba(20,20,20,0.6)',
                      border: graphics.particleQuality === level
                        ? '1px solid #c5a059'
                        : '1px solid rgba(197,160,89,0.12)',
                      color: graphics.particleQuality === level ? '#c5a059' : '#666',
                      borderRadius: level === 'low' ? '4px 0 0 4px' : level === 'high' ? '0 4px 4px 0' : '0',
                      marginLeft: level !== 'low' ? -1 : 0,
                    }}
                    onClick={() => updateGraphics({ particleQuality: level })}
                    data-testid={`button-particle-${level}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-sm text-gray-300 block">Screen Shake</span>
                <span className="text-xs text-gray-600">Camera shake on impacts and abilities</span>
              </div>
              <button
                className="relative cursor-pointer"
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  background: graphics.screenShake
                    ? 'linear-gradient(135deg, #c5a059, #8b6914)'
                    : 'rgba(30,30,30,0.8)',
                  border: `1px solid ${graphics.screenShake ? '#c5a059' : 'rgba(197,160,89,0.15)'}`,
                  transition: 'all 0.2s',
                }}
                onClick={() => updateGraphics({ screenShake: !graphics.screenShake })}
                data-testid="button-screen-shake"
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: graphics.screenShake ? 23 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-sm text-gray-300 block">Minimap Size</span>
                <span className="text-xs text-gray-600">{graphics.minimapSize}px</span>
              </div>
              <div className="flex items-center" style={{ gap: 10, minWidth: 180 }}>
                <span className="text-[10px] text-gray-600">120</span>
                <input
                  type="range"
                  min={120}
                  max={280}
                  step={10}
                  value={graphics.minimapSize}
                  onChange={(e) => updateGraphics({ minimapSize: parseInt(e.target.value) })}
                  className="flex-1"
                  style={{
                    accentColor: '#c5a059',
                    height: 4,
                  }}
                  data-testid="slider-minimap-size"
                />
                <span className="text-[10px] text-gray-600">280</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-md overflow-hidden mb-8"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,18,15,0.95), rgba(10,12,10,0.95))',
            border: '1px solid rgba(197,160,89,0.2)',
          }}
          data-testid="panel-audio"
        >
          <div
            className="px-4 py-2.5 text-xs font-bold tracking-wider uppercase"
            style={{ color: '#c5a059', background: 'rgba(197,160,89,0.06)', borderBottom: '1px solid rgba(197,160,89,0.15)' }}
          >
            Audio
          </div>

          <div className="px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {([
              { label: 'Master Volume', key: 'masterVolume' as const, description: 'Overall game volume' },
              { label: 'SFX Volume', key: 'sfxVolume' as const, description: 'Sound effects for combat and abilities' },
              { label: 'Music Volume', key: 'musicVolume' as const, description: 'Background music volume' },
            ]).map((vol) => (
              <div key={vol.key} className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-sm text-gray-300 block">{vol.label}</span>
                  <span className="text-xs text-gray-600">{vol.description}</span>
                </div>
                <div className="flex items-center" style={{ gap: 10, minWidth: 180 }}>
                  <span className="text-[10px] text-gray-600">0</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={graphics[vol.key]}
                    onChange={(e) => updateGraphics({ [vol.key]: parseInt(e.target.value) })}
                    className="flex-1"
                    style={{
                      accentColor: '#c5a059',
                      height: 4,
                    }}
                    data-testid={`slider-${vol.key}`}
                  />
                  <span className="text-[10px] text-gray-600 w-6 text-right">{graphics[vol.key]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-md overflow-hidden mb-8"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,18,15,0.95), rgba(10,12,10,0.95))',
            border: '1px solid rgba(197,160,89,0.2)',
          }}
          data-testid="panel-display"
        >
          <div
            className="px-4 py-2.5 text-xs font-bold tracking-wider uppercase"
            style={{ color: '#c5a059', background: 'rgba(197,160,89,0.06)', borderBottom: '1px solid rgba(197,160,89,0.15)' }}
          >
            Display
          </div>

          <div className="px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-sm text-gray-300 block">Show Debug Overlay</span>
                <span className="text-xs text-gray-600">Display FPS, position, and animation debug info</span>
              </div>
              <button
                className="relative cursor-pointer"
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  background: graphics.showDebugOverlay
                    ? 'linear-gradient(135deg, #c5a059, #8b6914)'
                    : 'rgba(30,30,30,0.8)',
                  border: `1px solid ${graphics.showDebugOverlay ? '#c5a059' : 'rgba(197,160,89,0.15)'}`,
                  transition: 'all 0.2s',
                }}
                onClick={() => updateGraphics({ showDebugOverlay: !graphics.showDebugOverlay })}
                data-testid="button-show-debug"
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: graphics.showDebugOverlay ? 23 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-sm text-gray-300 block">Show Damage Numbers</span>
                <span className="text-xs text-gray-600">Display floating damage and healing numbers</span>
              </div>
              <button
                className="relative cursor-pointer"
                style={{
                  width: 48,
                  height: 26,
                  borderRadius: 13,
                  background: graphics.showDamageNumbers
                    ? 'linear-gradient(135deg, #c5a059, #8b6914)'
                    : 'rgba(30,30,30,0.8)',
                  border: `1px solid ${graphics.showDamageNumbers ? '#c5a059' : 'rgba(197,160,89,0.15)'}`,
                  transition: 'all 0.2s',
                }}
                onClick={() => updateGraphics({ showDamageNumbers: !graphics.showDamageNumbers })}
                data-testid="button-show-damage-numbers"
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: graphics.showDamageNumbers ? 23 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
