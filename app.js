import React, { useEffect, useMemo, useState } from 'react';
import { render } from 'react-dom';
import PropTypes from 'prop-types';
import Busqueda from './components/Busqueda';
import Ajustes from './components/Ajustes';
import Mapa from './components/Mapa';
import PanelDerecho from './components/PanelDerecho';
import ListaItems from './components/ListaItems';
import { abc, clamp, uid } from './utils';

// Storage key for localStorage
const STORAGE_KEY = 'bodega_mapa_v1';

// Main App Component
function BodegaMapa() {
  const [cfg, setCfg] = useState(() => ({
    pasillos: 4,
    estantesPorPasillo: 4,
    casillasPorEstante: 6,
  }));
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null); // {p, e, c}
  const [panel, setPanel] = useState('mapa'); // mapa | items | ajustes

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.cfg) setCfg(parsed.cfg);
        if (parsed?.items) setItems(parsed.items);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      const data = { cfg, items };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, [cfg, items]);

  const letrasEstantes = useMemo(() => abc(cfg.estantesPorPasillo), [cfg.estantesPorPasillo]);
  const casillas = useMemo(() => Array.from({ length: cfg.casillasPorEstante }, (_, i) => i + 1), [cfg.casillasPorEstante]);

  const ubicacionAString = (u) => `P${u.p}-E${letrasEstantes[u.e - 1]}-C${u.c}`;

  const itemsFiltrados = useMemo(() => {
    if (!q.trim()) return items;
    const t = q.toLowerCase();
    return items.filter((it) =>
      [it.nombre, it.descripcion, it.tags?.join(' '), ubicacionAString(it.ubicacion)]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(t))
    );
  }, [items, q]);

  const itemsEnSel = useMemo(() => {
    if (!sel) return [];
    return items.filter(
      (it) => it.ubicacion.p === sel.p && it.ubicacion.e === sel.e && it.ubicacion.c === sel.c
    );
  }, [items, sel]);

  // Actions
  const agregarItem = (data) => {
    const nuevo = {
      id: uid(),
      nombre: data.nombre?.trim() || '(Sin nombre)',
      descripcion: data.descripcion?.trim() || '',
      ubicacion: data.ubicacion,
      tags: (data.tags || []).map((t) => t.trim()).filter(Boolean),
    };
    setItems((prev) => [nuevo, ...prev]);
  };

  const borrarItem = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  const moverItem = (id, nuevaUbi) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ubicacion: nuevaUbi } : x)));

  const vaciarTodo = () => {
    if (!window.confirm('¿Seguro que deseas borrar TODOS los items?')) return;
    setItems([]);
  };

  const exportarJSON = () => {
    const blob = new Blob([JSON.stringify({ cfg, items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bodega_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importarJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data?.cfg && data?.items) {
          setCfg({
            pasillos: clamp(Number(data.cfg.pasillos) || 1, 1, 50),
            estantesPorPasillo: clamp(Number(data.cfg.estantesPorPasillo) || 1, 1, 26),
            casillasPorEstante: clamp(Number(data.cfg.casillasPorEstante) || 1, 1, 200),
          });
          setItems(Array.isArray(data.items) ? data.items : []);
          alert('Datos importados correctamente');
        } else {
          alert('Archivo inválido');
        }
      } catch (e) {
        alert('No se pudo leer el archivo');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">📦 Mapa de Bodega</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Busqueda q={q} setQ={setQ} />
            <button onClick={() => setPanel('mapa')} className={btn(panel === 'mapa')}>
              Mapa
            </button>
            <button onClick={() => setPanel('items')} className={btn(panel === 'items')}>
              Items
            </button>
            <button onClick={() => setPanel('ajustes')} className={btn(panel === 'ajustes')}>
              Ajustes
            </button>
            <button onClick={exportarJSON} className="px-3 py-2 rounded-xl bg-white shadow hover:shadow-md border">
              Exportar
            </button>
            <label className="px-3 py-2 rounded-xl bg-white shadow hover:shadow-md border cursor-pointer">
              Importar
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importarJSON(e.target.files[0])}
              />
            </label>
          </div>
        </header>

        {panel === 'ajustes' && <Ajustes cfg={cfg} setCfg={setCfg} letrasEstantes={letrasEstantes} />}

        {panel === 'mapa' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <Mapa cfg={cfg} letrasEstantes={letrasEstantes} casillas={casillas} sel={sel} setSel={setSel} />
            </div>
            <div className="xl:col-span-1">
              <PanelDerecho
                sel={sel}
                letrasEstantes={letrasEstantes}
                items={itemsEnSel}
                onAdd={(d) => agregarItem({ ...d, ubicacion: sel })}
                onDelete={borrarItem}
                onMove={moverItem}
                cfg={cfg}
              />
            </div>
          </div>
        )}

        {panel === 'items' && (
          <ListaItems
            items={itemsFiltrados}
            q={q}
            setQ={setQ}
            moverItem={moverItem}
            borrarItem={borrarItem}
            cfg={cfg}
            letrasEstantes={letrasEstantes}
            onVaciarTodo={vaciarTodo}
          />
        )}

        <footer className="mt-8 text-sm text-slate-500">
          Guardado automático en este navegador. Exporta un respaldo si es importante.
        </footer>
      </div>
    </div>
  );
}

// Button style utility
function btn(active) {
  return `px-3 py-2 rounded-xl border ${active ? 'bg-slate-900 text-white' : 'bg-white hover:shadow'}`;
}

// Render the app
render(<BodegaMapa />, document.getElementById('root'));

// Global event listener for clearing items
if (typeof window !== 'undefined') {
  window.addEventListener('vaciar-todo', () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    try {
      const parsed = JSON.parse(raw || '{}');
      const toSave = { ...(parsed || {}), items: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      window.dispatchEvent(new Event('storage'));
    } catch {
      console.error('Error clearing items:', e);
    }
  });
}
