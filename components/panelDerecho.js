import React from 'react';
import PropTypes from 'prop-types';
import NuevoItem from './NuevoItem';
import Mover from './Mover';

function PanelDerecho({ sel, letrasEstantes, items, onAdd, onDelete, onMove, cfg }) {
  if (!sel) {
    return (
      <div className="bg-white border rounded-2xl p-4 shadow-sm text-slate-600">
        Selecciona una casilla en el mapa para ver/gestionar sus items.
      </div>
    );
  }

  const label = `Pasillo ${sel.p} · Estante ${letrasEstantes[sel.e - 1]} · Casilla ${sel.c}`;

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-2">{label}</h2>
      <NuevoItem onAdd={onAdd} />
      <div className="mt-4">
        {items.length === 0 ? (
          <div className="text-sm text-slate-600">No hay items aquí todavía.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="border rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{it.nombre}</div>
                    {it.descripcion && <div className="text-sm text-slate-600">{it.descripcion}</div>}
                    {it.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {it.tags.map((t) => (
                          <span key={t} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full border">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mover it={it} cfg={cfg} onMove={onMove} />
                    <button
                      onClick={() => onDelete(it.id)}
                      className="px-2 py-1 text-sm border rounded-lg hover:bg-slate-50"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

PanelDerecho.propTypes = {
  sel: PropTypes.shape({
    p: PropTypes.number,
    e: PropTypes.number,
    c: PropTypes.number,
  }),
  letrasEstantes: PropTypes.arrayOf(PropTypes.string).isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      nombre: PropTypes.string.isRequired,
      descripcion: PropTypes.string,
      ubicacion: PropTypes.shape({
        p: PropTypes.number.isRequired,
        e: PropTypes.number.isRequired,
        c: PropTypes.number.isRequired,
      }).isRequired,
      tags: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  onAdd: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onMove: PropTypes.func.isRequired,
  cfg: PropTypes.shape({
    pasillos: PropTypes.number.isRequired,
    estantesPorPasillo: PropTypes.number.isRequired,
    casillasPorEstante: PropTypes.number.isRequired,
  }).isRequired,
};

export default PanelDerecho;
