import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  MapData, MapDecoration, MapCampDef, createDefaultMapData,
  saveMapData, loadMapData, downloadMapJSON, importMapJSON,
  TERRAIN_TYPES, DECORATION_TYPES, DECORATION_CATEGORIES, CAMP_TYPES,
  TILE_SIZE, GRID_SIZE,
} from '../game/map-data';
import { MAP_SIZE } from '../game/types';

type Tool = 'terrain' | 'height' | 'object' | 'camp' | 'lane' | 'collision' | 'erase' | 'select';

interface Camera { x: number; y: number; zoom: number; }

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'terrain', label: '🎨 Terrain', key: '1' },
  { id: 'height', label: '⬆ Height', key: '2' },
  { id: 'object', label: '🌲 Object', key: '3' },
  { id: 'camp', label: '⚔ Camp', key: '4' },
  { id: 'lane', label: '🛤 Lane', key: '5' },
  { id: 'collision', label: '🧱 Collision', key: '6' },
  { id: 'erase', label: '🗑 Erase', key: '7' },
  { id: 'select', label: '✋ Select', key: '8' },
];

export default function MapAdminPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapData, setMapData] = useState<MapData>(() => loadMapData() || createDefaultMapData());
  const mapRef = useRef<MapData>(mapData);

  const [tool, setTool] = useState<Tool>('terrain');
  const [terrainType, setTerrainType] = useState(0);
  const [brushSize, setBrushSize] = useState(2);
  const [heightValue, setHeightValue] = useState(2);
  const [selectedDecoType, setSelectedDecoType] = useState('tree');
  const [selectedCampType, setSelectedCampType] = useState<'small' | 'medium' | 'buff' | 'boss'>('small');
  const [activeLaneIdx, setActiveLaneIdx] = useState(0);
  const [decoCategory, setDecoCategory] = useState<string>('Trees');
  const [objectScale, setObjectScale] = useState(1.0);
  const [objectRotation, setObjectRotation] = useState(0);
  const [selectedDecoId, setSelectedDecoId] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showCollision, setShowCollision] = useState(true);
  const [showCamps, setShowCamps] = useState(true);
  const [showLanes, setShowLanes] = useState(true);
  const [gizmoMode, setGizmoMode] = useState<'move' | 'scale' | 'rotate'>('move');
  const [statusMsg, setStatusMsg] = useState('');

  const camRef = useRef<Camera>({ x: MAP_SIZE / 2, y: MAP_SIZE / 2, zoom: 0.15 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });
  const isPaintingRef = useRef(false);
  const dragDecoRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number; origScale: number; origRot: number } | null>(null);
  const animRef = useRef(0);

  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);

  useEffect(() => { mapRef.current = mapData; }, [mapData]);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push(JSON.stringify(mapRef.current));
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push(JSON.stringify(mapRef.current));
    const prev = JSON.parse(undoStackRef.current.pop()!) as MapData;
    setMapData(prev);
  }, []);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(JSON.stringify(mapRef.current));
    const next = JSON.parse(redoStackRef.current.pop()!) as MapData;
    setMapData(next);
  }, []);

  // World <-> Screen coordinate transforms
  const worldToScreen = useCallback((wx: number, wy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 0, sy: 0 };
    const cam = camRef.current;
    const sx = (wx - cam.x) * cam.zoom + canvas.width / 2;
    const sy = (wy - cam.y) * cam.zoom + canvas.height / 2;
    return { sx, sy };
  }, []);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0 };
    const cam = camRef.current;
    const wx = (sx - canvas.width / 2) / cam.zoom + cam.x;
    const wy = (sy - canvas.height / 2) / cam.zoom + cam.y;
    return { wx, wy };
  }, []);

  const worldToTile = (wx: number, wy: number) => ({
    tx: Math.floor(wx / TILE_SIZE),
    ty: Math.floor(wy / TILE_SIZE),
  });

  // Painting functions
  const paintTerrain = useCallback((wx: number, wy: number, value: number) => {
    const { tx, ty } = worldToTile(wx, wy);
    const r = brushSize - 1;
    setMapData(prev => {
      const terrain = prev.terrain.map(row => [...row]);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = tx + dx, py = ty + dy;
          if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
            if (dx * dx + dy * dy <= r * r + r) {
              terrain[py][px] = value;
            }
          }
        }
      }
      return { ...prev, terrain };
    });
  }, [brushSize]);

  const paintHeight = useCallback((wx: number, wy: number, value: number) => {
    const { tx, ty } = worldToTile(wx, wy);
    const r = brushSize - 1;
    setMapData(prev => {
      const heightmap = prev.heightmap.map(row => [...row]);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = tx + dx, py = ty + dy;
          if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
            if (dx * dx + dy * dy <= r * r + r) {
              heightmap[py][px] = value;
            }
          }
        }
      }
      return { ...prev, heightmap };
    });
  }, [brushSize]);

  const paintCollision = useCallback((wx: number, wy: number, value: boolean) => {
    const { tx, ty } = worldToTile(wx, wy);
    const r = brushSize - 1;
    setMapData(prev => {
      const collision = prev.collision.map(row => [...row]);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = tx + dx, py = ty + dy;
          if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
            if (dx * dx + dy * dy <= r * r + r) {
              collision[py][px] = value;
            }
          }
        }
      }
      return { ...prev, collision };
    });
  }, [brushSize]);

  const placeObject = useCallback((wx: number, wy: number) => {
    setMapData(prev => {
      const deco: MapDecoration = {
        id: prev.nextDecoId,
        x: wx, y: wy,
        type: selectedDecoType,
        seed: Math.floor(Math.random() * 10000),
        scale: objectScale,
        rotation: objectRotation,
      };
      return { ...prev, decorations: [...prev.decorations, deco], nextDecoId: prev.nextDecoId + 1 };
    });
  }, [selectedDecoType, objectScale, objectRotation]);

  const placeCamp = useCallback((wx: number, wy: number) => {
    const camp: MapCampDef = {
      x: wx, y: wy, type: selectedCampType,
      mobCount: CAMP_TYPES.find(c => c.id === selectedCampType)?.mobCount,
    };
    setMapData(prev => ({ ...prev, camps: [...prev.camps, camp] }));
  }, [selectedCampType]);

  const addLaneWaypoint = useCallback((wx: number, wy: number) => {
    setMapData(prev => {
      const lanes = prev.laneWaypoints.map((l, i) => i === activeLaneIdx ? [...l, { x: wx, y: wy }] : [...l]);
      while (lanes.length <= activeLaneIdx) lanes.push([]);
      if (!lanes[activeLaneIdx]) lanes[activeLaneIdx] = [];
      lanes[activeLaneIdx] = [...lanes[activeLaneIdx], { x: wx, y: wy }];
      return { ...prev, laneWaypoints: lanes };
    });
  }, [activeLaneIdx]);

  const eraseAt = useCallback((wx: number, wy: number) => {
    setMapData(prev => {
      // Erase decorations within 60px
      const decos = prev.decorations.filter(d => {
        const dx = d.x - wx, dy = d.y - wy;
        return Math.sqrt(dx * dx + dy * dy) > 60;
      });
      // Erase camps within 80px
      const camps = prev.camps.filter(c => {
        const dx = c.x - wx, dy = c.y - wy;
        return Math.sqrt(dx * dx + dy * dy) > 80;
      });
      return { ...prev, decorations: decos, camps };
    });
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Middle mouse or space+click for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanningRef.current = true;
      panStartRef.current = { mx: sx, my: sy, cx: camRef.current.x, cy: camRef.current.y };
      return;
    }

    if (e.button !== 0) return;

    const { wx, wy } = screenToWorld(sx, sy);

    if (tool === 'select') {
      // Check if clicking on a decoration for gizmo
      let closest: MapDecoration | null = null;
      let closestDist = 40 / camRef.current.zoom;
      for (const d of mapRef.current.decorations) {
        const dx = d.x - wx, dy = d.y - wy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) { closestDist = dist; closest = d; }
      }
      if (closest) {
        setSelectedDecoId(closest.id);
        dragDecoRef.current = {
          id: closest.id, startX: sx, startY: sy,
          origX: closest.x, origY: closest.y,
          origScale: closest.scale, origRot: closest.rotation,
        };
        pushUndo();
      } else {
        setSelectedDecoId(null);
      }
      return;
    }

    pushUndo();
    isPaintingRef.current = true;

    if (tool === 'terrain') paintTerrain(wx, wy, terrainType);
    else if (tool === 'height') paintHeight(wx, wy, heightValue);
    else if (tool === 'collision') paintCollision(wx, wy, true);
    else if (tool === 'object') placeObject(wx, wy);
    else if (tool === 'camp') placeCamp(wx, wy);
    else if (tool === 'lane') addLaneWaypoint(wx, wy);
    else if (tool === 'erase') eraseAt(wx, wy);
  }, [tool, terrainType, brushSize, heightValue, selectedDecoType, selectedCampType, objectScale, objectRotation,
    paintTerrain, paintHeight, paintCollision, placeObject, placeCamp, addLaneWaypoint, eraseAt, pushUndo, screenToWorld]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (isPanningRef.current) {
      const dx = (sx - panStartRef.current.mx) / camRef.current.zoom;
      const dy = (sy - panStartRef.current.my) / camRef.current.zoom;
      camRef.current.x = panStartRef.current.cx - dx;
      camRef.current.y = panStartRef.current.cy - dy;
      return;
    }

    // Gizmo drag
    if (dragDecoRef.current && tool === 'select') {
      const d = dragDecoRef.current;
      const dx = (sx - d.startX) / camRef.current.zoom;
      const dy = (sy - d.startY) / camRef.current.zoom;
      setMapData(prev => ({
        ...prev,
        decorations: prev.decorations.map(deco => {
          if (deco.id !== d.id) return deco;
          if (gizmoMode === 'move') return { ...deco, x: d.origX + dx, y: d.origY + dy };
          if (gizmoMode === 'scale') return { ...deco, scale: Math.max(0.2, d.origScale + dy * 0.005) };
          if (gizmoMode === 'rotate') return { ...deco, rotation: d.origRot + dx * 0.5 };
          return deco;
        }),
      }));
      return;
    }

    if (!isPaintingRef.current) return;
    const { wx, wy } = screenToWorld(sx, sy);

    if (tool === 'terrain') paintTerrain(wx, wy, terrainType);
    else if (tool === 'height') paintHeight(wx, wy, heightValue);
    else if (tool === 'collision') paintCollision(wx, wy, true);
    else if (tool === 'erase') eraseAt(wx, wy);
  }, [tool, terrainType, heightValue, gizmoMode, paintTerrain, paintHeight, paintCollision, eraseAt, screenToWorld]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    isPaintingRef.current = false;
    dragDecoRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cam = camRef.current;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    cam.zoom = Math.max(0.02, Math.min(2.0, cam.zoom * factor));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveMapData(mapRef.current);
        setStatusMsg('Map saved!');
        setTimeout(() => setStatusMsg(''), 2000);
        return;
      }
      if (e.key === 'Delete' && selectedDecoId !== null) {
        pushUndo();
        setMapData(prev => ({ ...prev, decorations: prev.decorations.filter(d => d.id !== selectedDecoId) }));
        setSelectedDecoId(null);
        return;
      }
      for (const t of TOOLS) {
        if (e.key === t.key && !e.ctrlKey && !e.altKey) { setTool(t.id); return; }
      }
      if (e.key === 'g') setShowGrid(v => !v);
      if (e.key === 'w') setGizmoMode('move');
      if (e.key === 'e') setGizmoMode('rotate');
      if (e.key === 'r') setGizmoMode('scale');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedDecoId, pushUndo]);

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Render loop
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) { animRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      const cam = camRef.current;
      const md = mapRef.current;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // Draw terrain tiles
      const tileScreenSize = TILE_SIZE;
      const viewLeft = cam.x - W / 2 / cam.zoom;
      const viewTop = cam.y - H / 2 / cam.zoom;
      const viewRight = cam.x + W / 2 / cam.zoom;
      const viewBottom = cam.y + H / 2 / cam.zoom;
      const txMin = Math.max(0, Math.floor(viewLeft / TILE_SIZE));
      const tyMin = Math.max(0, Math.floor(viewTop / TILE_SIZE));
      const txMax = Math.min(GRID_SIZE - 1, Math.ceil(viewRight / TILE_SIZE));
      const tyMax = Math.min(GRID_SIZE - 1, Math.ceil(viewBottom / TILE_SIZE));

      for (let ty = tyMin; ty <= tyMax; ty++) {
        for (let tx = txMin; tx <= txMax; tx++) {
          const terrainIdx = md.terrain[ty]?.[tx] ?? 0;
          const tt = TERRAIN_TYPES[terrainIdx] || TERRAIN_TYPES[0];
          const h = md.heightmap[ty]?.[tx] ?? 1;
          const brightness = 0.6 + h * 0.1;

          ctx.fillStyle = adjustBrightness(tt.color, brightness);
          ctx.fillRect(tx * tileScreenSize, ty * tileScreenSize, tileScreenSize, tileScreenSize);

          // Collision overlay
          if (showCollision && md.collision[ty]?.[tx]) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.25)';
            ctx.fillRect(tx * tileScreenSize, ty * tileScreenSize, tileScreenSize, tileScreenSize);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            // Draw X
            ctx.beginPath();
            ctx.moveTo(tx * tileScreenSize + 4, ty * tileScreenSize + 4);
            ctx.lineTo((tx + 1) * tileScreenSize - 4, (ty + 1) * tileScreenSize - 4);
            ctx.moveTo((tx + 1) * tileScreenSize - 4, ty * tileScreenSize + 4);
            ctx.lineTo(tx * tileScreenSize + 4, (ty + 1) * tileScreenSize - 4);
            ctx.stroke();
          }
        }
      }

      // Grid overlay
      if (showGrid && cam.zoom > 0.06) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1 / cam.zoom;
        for (let ty = tyMin; ty <= tyMax + 1; ty++) {
          ctx.beginPath();
          ctx.moveTo(txMin * tileScreenSize, ty * tileScreenSize);
          ctx.lineTo((txMax + 1) * tileScreenSize, ty * tileScreenSize);
          ctx.stroke();
        }
        for (let tx = txMin; tx <= txMax + 1; tx++) {
          ctx.beginPath();
          ctx.moveTo(tx * tileScreenSize, tyMin * tileScreenSize);
          ctx.lineTo(tx * tileScreenSize, (tyMax + 1) * tileScreenSize);
          ctx.stroke();
        }
      }

      // Draw lanes
      if (showLanes) {
        const laneColors = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6'];
        for (let i = 0; i < md.laneWaypoints.length; i++) {
          const lane = md.laneWaypoints[i];
          if (lane.length < 2) continue;
          ctx.strokeStyle = laneColors[i % laneColors.length];
          ctx.lineWidth = 6;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.moveTo(lane[0].x, lane[0].y);
          for (let j = 1; j < lane.length; j++) ctx.lineTo(lane[j].x, lane[j].y);
          ctx.stroke();
          ctx.globalAlpha = 1;
          // Waypoint dots
          for (let j = 0; j < lane.length; j++) {
            ctx.fillStyle = laneColors[i % laneColors.length];
            ctx.beginPath();
            ctx.arc(lane[j].x, lane[j].y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${j}`, lane[j].x, lane[j].y + 4);
          }
        }
      }

      // Draw decorations
      for (const deco of md.decorations) {
        if (deco.x < viewLeft - 100 || deco.x > viewRight + 100 || deco.y < viewTop - 100 || deco.y > viewBottom + 100) continue;
        const dt = DECORATION_TYPES.find(d => d.id === deco.type);
        const color = dt?.color || '#888';
        const size = 12 * deco.scale;
        const isSelected = deco.id === selectedDecoId;

        ctx.save();
        ctx.translate(deco.x, deco.y);
        ctx.rotate(deco.rotation * Math.PI / 180);

        // Draw based on type category
        if (deco.type.includes('tree') || deco.type === 'pine_tree' || deco.type === 'birch_tree') {
          // Tree: triangle + trunk
          ctx.fillStyle = '#5a3a1a';
          ctx.fillRect(-3 * deco.scale, 2 * deco.scale, 6 * deco.scale, 10 * deco.scale);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(-size * 0.8, size * 0.3);
          ctx.lineTo(size * 0.8, size * 0.3);
          ctx.closePath();
          ctx.fill();
        } else if (deco.type.includes('rock') || deco.type.includes('boulder') || deco.type === 'pebble') {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.type.includes('volcano')) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, -size * 1.5);
          ctx.lineTo(-size, size * 0.5);
          ctx.lineTo(size, size * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ff4400';
          ctx.beginPath();
          ctx.arc(0, -size, size * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.type.includes('bush') || deco.type.includes('fern') || deco.type.includes('grass') || deco.type === 'clover' || deco.type === 'plant') {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.7, size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.type.includes('fire') || deco.type === 'campfire' || deco.type === 'lava_pool') {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffdd00';
          ctx.beginPath();
          ctx.arc(0, -2, size * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Generic square
          ctx.fillStyle = color;
          ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
        }

        // Selection highlight
        if (isSelected) {
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, size + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Gizmo
          if (gizmoMode === 'move') {
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30, 0); ctx.stroke();
            ctx.strokeStyle = '#22c55e';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
          } else if (gizmoMode === 'rotate') {
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
          } else {
            ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2;
            ctx.strokeRect(-20, -20, 40, 40);
          }
        }

        ctx.restore();
      }

      // Draw camps
      if (showCamps) {
        for (const camp of md.camps) {
          if (camp.x < viewLeft - 200 || camp.x > viewRight + 200 || camp.y < viewTop - 200 || camp.y > viewBottom + 200) continue;
          const ct = CAMP_TYPES.find(c => c.id === camp.type);
          const color = ct?.color || '#fff';
          const radius = camp.type === 'boss' ? 120 : camp.type === 'buff' ? 80 : 50;
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(camp.x, camp.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(camp.type.toUpperCase(), camp.x, camp.y + 6);
        }
      }

      // Draw boss pit
      if (md.bossPit) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(md.bossPit.x, md.bossPit.y, md.bossPit.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff000044';
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS PIT', md.bossPit.x, md.bossPit.y + 6);
      }

      // Draw campfires
      for (const cf of md.campfires) {
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(cf.x, cf.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffdd00';
        ctx.beginPath();
        ctx.arc(cf.x, cf.y - 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`T${cf.team}`, cf.x, cf.y + 25);
      }

      // Base positions
      for (let i = 0; i < md.basePositions.length; i++) {
        const bp = md.basePositions[i];
        ctx.strokeStyle = i === 0 ? '#3b82f6' : '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 180, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = (i === 0 ? '#3b82f6' : '#ef4444') + '22';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(i === 0 ? 'BLUE BASE' : 'RED BASE', bp.x, bp.y + 8);
      }

      // Map boundary
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

      ctx.restore();

      // HUD - coords
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(W - 200, H - 30, 200, 30);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Zoom: ${(cam.zoom * 100).toFixed(0)}%  |  ${Math.round(cam.x)}, ${Math.round(cam.y)}`, W - 10, H - 10);

      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [showGrid, showCollision, showCamps, showLanes, selectedDecoId, gizmoMode]);

  const handleSave = () => {
    saveMapData(mapData);
    setStatusMsg('Map saved to game!');
    setTimeout(() => setStatusMsg(''), 2000);
  };

  const handleExport = () => downloadMapJSON(mapData);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = importMapJSON(reader.result as string);
        if (data) {
          pushUndo();
          setMapData(data);
          setStatusMsg('Map imported!');
        } else {
          setStatusMsg('Invalid map file');
        }
        setTimeout(() => setStatusMsg(''), 2000);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClearLane = () => {
    pushUndo();
    setMapData(prev => {
      const lanes = prev.laneWaypoints.map((l, i) => i === activeLaneIdx ? [] : [...l]);
      return { ...prev, laneWaypoints: lanes };
    });
  };

  const handleReset = () => {
    if (!confirm('Reset map to default? This cannot be undone.')) return;
    setMapData(createDefaultMapData());
    setStatusMsg('Map reset');
    setTimeout(() => setStatusMsg(''), 2000);
  };

  const selectedDeco = mapData.decorations.find(d => d.id === selectedDecoId);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none" onContextMenu={e => e.preventDefault()}>
      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onWheel={handleWheel} />

      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gray-900/90 border-b border-gray-700 flex items-center px-3 gap-2 z-10">
        <button onClick={() => setLocation('/')} className="text-gray-400 hover:text-white text-sm mr-2">← Home</button>
        <div className="text-amber-400 font-bold text-sm mr-4">MAP ADMIN</div>

        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${tool === t.id ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {t.label} <span className="text-gray-500 ml-0.5">[{t.key}]</span>
          </button>
        ))}

        <div className="flex-1" />

        <button onClick={undo} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 hover:bg-gray-700">Undo</button>
        <button onClick={redo} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 hover:bg-gray-700">Redo</button>
        <button onClick={handleSave} className="px-3 py-1 bg-green-700 rounded text-xs text-white font-bold hover:bg-green-600">💾 Save</button>
        <button onClick={handleExport} className="px-2 py-1 bg-blue-800 rounded text-xs text-gray-300 hover:bg-blue-700">Export</button>
        <button onClick={handleImport} className="px-2 py-1 bg-blue-800 rounded text-xs text-gray-300 hover:bg-blue-700">Import</button>
        <button onClick={handleReset} className="px-2 py-1 bg-red-900 rounded text-xs text-gray-300 hover:bg-red-800">Reset</button>

        {statusMsg && <div className="text-green-400 text-xs font-bold animate-pulse">{statusMsg}</div>}
      </div>

      {/* Left Sidebar - Tool Options */}
      <div className="absolute top-12 left-0 w-56 bottom-0 bg-gray-900/90 border-r border-gray-700 overflow-y-auto z-10 p-3 space-y-3">
        {tool === 'terrain' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Terrain Palette</div>
            <div className="grid grid-cols-2 gap-1">
              {TERRAIN_TYPES.map(tt => (
                <button key={tt.id} onClick={() => setTerrainType(tt.id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] ${terrainType === tt.id ? 'ring-2 ring-amber-500 bg-gray-800' : 'bg-gray-800/50 hover:bg-gray-800'}`}>
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: tt.color }} />
                  <span className="text-gray-300 truncate">{tt.name}</span>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 uppercase font-bold mt-2">Brush Size</div>
            <input type="range" min={1} max={8} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="text-amber-400 text-xs text-center">{brushSize} tiles</div>
          </>
        )}

        {tool === 'height' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Height Value</div>
            <input type="range" min={0} max={4} value={heightValue} onChange={e => setHeightValue(Number(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="text-amber-400 text-xs text-center">Height: {heightValue}</div>
            <div className="text-xs text-gray-400 uppercase font-bold mt-2">Brush Size</div>
            <input type="range" min={1} max={8} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="text-amber-400 text-xs text-center">{brushSize} tiles</div>
          </>
        )}

        {tool === 'collision' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Tree-Wall Collision</div>
            <p className="text-gray-500 text-[10px]">Paint collision zones. Units can walk INTO trees but not THROUGH — like Dota tree collision.</p>
            <div className="text-xs text-gray-400 uppercase font-bold mt-2">Brush Size</div>
            <input type="range" min={1} max={8} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="text-amber-400 text-xs text-center">{brushSize} tiles</div>
          </>
        )}

        {tool === 'object' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Category</div>
            <div className="flex flex-wrap gap-1">
              {DECORATION_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setDecoCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] ${decoCategory === cat ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 uppercase font-bold mt-2">Objects</div>
            <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
              {DECORATION_TYPES.filter(d => d.category === decoCategory).map(dt => (
                <button key={dt.id} onClick={() => setSelectedDecoType(dt.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${selectedDecoType === dt.id ? 'ring-2 ring-amber-500 bg-gray-800' : 'bg-gray-800/50 hover:bg-gray-800'}`}>
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: dt.color }} />
                  <span className="text-gray-300">{dt.icon} {dt.name}</span>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 uppercase font-bold mt-2">Scale</div>
            <input type="range" min={0.3} max={4} step={0.1} value={objectScale}
              onChange={e => setObjectScale(Number(e.target.value))} className="w-full accent-amber-500" />
            <div className="text-amber-400 text-xs text-center">{objectScale.toFixed(1)}x</div>
            <div className="text-xs text-gray-400 uppercase font-bold mt-2">Rotation</div>
            <input type="range" min={0} max={360} step={5} value={objectRotation}
              onChange={e => setObjectRotation(Number(e.target.value))} className="w-full accent-amber-500" />
            <div className="text-amber-400 text-xs text-center">{objectRotation}°</div>
          </>
        )}

        {tool === 'camp' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Camp Type</div>
            <div className="space-y-1">
              {CAMP_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setSelectedCampType(ct.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs ${selectedCampType === ct.id ? 'ring-2 ring-amber-500 bg-gray-800' : 'bg-gray-800/50 hover:bg-gray-800'}`}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ct.color }} />
                  <span className="text-gray-300">{ct.name}</span>
                  <span className="text-gray-500 text-[10px] ml-auto">{ct.mobCount} mobs</span>
                </button>
              ))}
            </div>
            <div className="text-gray-500 text-[10px] mt-2">Click on map to place camp. Use Erase tool to remove.</div>
          </>
        )}

        {tool === 'lane' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Lane Editor</div>
            <div className="space-y-1">
              {[0, 1, 2].map(i => (
                <button key={i} onClick={() => setActiveLaneIdx(i)}
                  className={`w-full px-2 py-1.5 rounded text-xs ${activeLaneIdx === i ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  Lane {i + 1} ({mapData.laneWaypoints[i]?.length || 0} pts)
                </button>
              ))}
            </div>
            <button onClick={handleClearLane}
              className="w-full mt-2 px-2 py-1 bg-red-900 rounded text-xs text-gray-300 hover:bg-red-800">
              Clear Lane {activeLaneIdx + 1}
            </button>
            <div className="text-gray-500 text-[10px] mt-2">Click to add waypoints. Lanes define minion paths.</div>
          </>
        )}

        {tool === 'select' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Gizmo Mode</div>
            <div className="flex gap-1">
              {(['move', 'rotate', 'scale'] as const).map(m => (
                <button key={m} onClick={() => setGizmoMode(m)}
                  className={`flex-1 px-2 py-1 rounded text-xs capitalize ${gizmoMode === m ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  {m} [{m === 'move' ? 'W' : m === 'rotate' ? 'E' : 'R'}]
                </button>
              ))}
            </div>
            {selectedDeco && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-400 uppercase font-bold">Selected Object</div>
                <div className="bg-gray-800 rounded p-2 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-amber-400">{selectedDeco.type}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">X</span><span className="text-white">{Math.round(selectedDeco.x)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Y</span><span className="text-white">{Math.round(selectedDeco.y)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Scale</span><span className="text-white">{selectedDeco.scale.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Rotation</span><span className="text-white">{Math.round(selectedDeco.rotation)}°</span></div>
                </div>
                <button onClick={() => {
                  pushUndo();
                  setMapData(prev => ({ ...prev, decorations: prev.decorations.filter(d => d.id !== selectedDecoId) }));
                  setSelectedDecoId(null);
                }} className="w-full px-2 py-1 bg-red-900 rounded text-xs text-gray-300 hover:bg-red-800">
                  Delete Object [Del]
                </button>
              </div>
            )}
            <div className="text-gray-500 text-[10px] mt-2">Click objects to select. Drag to move/rotate/scale. Press Del to delete.</div>
          </>
        )}

        {tool === 'erase' && (
          <>
            <div className="text-xs text-gray-400 uppercase font-bold">Eraser</div>
            <p className="text-gray-500 text-[10px]">Click/drag to remove decorations and camps near cursor.</p>
          </>
        )}

        {/* View toggles */}
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="text-xs text-gray-400 uppercase font-bold mb-2">View Toggles</div>
          {[
            { label: 'Grid [G]', value: showGrid, setter: setShowGrid },
            { label: 'Collision', value: showCollision, setter: setShowCollision },
            { label: 'Camps', value: showCamps, setter: setShowCamps },
            { label: 'Lanes', value: showLanes, setter: setShowLanes },
          ].map(tog => (
            <label key={tog.label} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer mb-1">
              <input type="checkbox" checked={tog.value} onChange={() => tog.setter(v => !v)} className="accent-amber-500" />
              {tog.label}
            </label>
          ))}
        </div>

        {/* Stats */}
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="text-xs text-gray-400 uppercase font-bold mb-1">Map Stats</div>
          <div className="text-[10px] text-gray-500 space-y-0.5">
            <div>Objects: {mapData.decorations.length}</div>
            <div>Camps: {mapData.camps.length}</div>
            <div>Lanes: {mapData.laneWaypoints.filter(l => l.length > 0).length}</div>
            <div>Map: {MAP_SIZE}x{MAP_SIZE} ({GRID_SIZE}x{GRID_SIZE} tiles)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function adjustBrightness(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r * factor), clamp(g * factor), clamp(b * factor)]
    .map(v => v.toString(16).padStart(2, '0')).join('');
}
