import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  KeybindAction, KeybindConfig, KeyBind,
  ACTION_CATEGORIES, ACTION_LABELS,
  loadKeybindings, saveKeybindings, resetKeybindings,
  keyBindLabel,
} from '@/game/keybindings';

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [bindings, setBindings] = useState<KeybindConfig>(loadKeybindings);
  const [rebinding, setRebinding] = useState<KeybindAction | null>(null);

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

  return (
    <div
      className="min-h-screen flex flex-col items-center py-8 px-4"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%)',
        fontFamily: "'Oxanium', sans-serif",
      }}
      data-testid="settings-page"
    >
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-3xl font-black tracking-wider"
            style={{ color: '#c5a059', textShadow: '0 0 20px rgba(197,160,89,0.3)' }}
            data-testid="text-settings-title"
          >
            KEYBINDINGS
          </h1>
          <button
            className="px-4 py-2 text-sm font-bold rounded border border-[#c5a059]/40 text-[#c5a059] hover:bg-[#c5a059]/10 transition-all cursor-pointer"
            onClick={() => setLocation('/')}
            data-testid="button-back"
          >
            BACK
          </button>
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

        <div className="space-y-4">
          {Object.entries(ACTION_CATEGORIES).map(([category, actions]) => (
            <div
              key={category}
              className="rounded-lg overflow-hidden"
              style={{
                background: 'linear-gradient(to bottom, #1a1a2e, #0f0f1a)',
                border: '1px solid #c5a059/30',
              }}
            >
              <div
                className="px-4 py-2 text-sm font-bold tracking-wider uppercase"
                style={{ color: '#c5a059', background: 'rgba(197,160,89,0.08)', borderBottom: '1px solid rgba(197,160,89,0.2)' }}
              >
                {category}
              </div>
              <div className="divide-y divide-gray-800/50">
                {actions.map(action => (
                  <div key={action} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <span className="text-sm text-gray-300">{ACTION_LABELS[action]}</span>
                    <button
                      className={`px-3 py-1 text-sm font-mono rounded transition-all cursor-pointer min-w-[80px] text-center ${
                        rebinding === action
                          ? 'bg-[#c5a059]/20 border border-[#c5a059] text-[#c5a059] animate-pulse'
                          : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:border-[#c5a059]/50 hover:text-[#c5a059]'
                      }`}
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
            className="px-6 py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-red-900/50 to-red-800/50 border border-red-700/30 text-red-400 hover:from-red-800/50 hover:to-red-700/50 transition-all cursor-pointer"
            onClick={handleReset}
            data-testid="button-reset-defaults"
          >
            RESET TO DEFAULTS
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-600">Click any binding to rebind it. Press the new key or mouse button.</p>
          <p className="text-xs text-gray-600 mt-1">Mouse buttons: Left Click (LMB), Right Click (RMB), Middle Click (MMB)</p>
        </div>
      </div>
    </div>
  );
}
