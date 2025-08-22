import React from 'react';
import PropTypes from 'prop-types';

function Mapa({ cfg, letrasEstantes, casillas, sel, setSel }) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Mapa visual</h2>
      <div className="overflow-auto">
        <div
          className="min-w-[640px] grid"
          style={{ gridTemplateColumns: `repeat(${cfg.pasillos}, minmax(180px, 1fr))`, gap: '12px' }}
        >
          {Array.from({ length: cfg.pasillos }, (_, p) => (
            <div key={p} className="border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-100 font-medium">Pasillo {p + 1}</div>
              <div className="divide-y">
                {letrasEstantes.map((L, ei) => (
                  <div key={L}>
                    <div className="px-3 py-1 text-sm text-slate-600 bg-slate-50">Estante {L}</div>
                    <div className="grid grid-cols-6 gap-2 p-2">
                      {casillas.map((c) => {
                        const activo = sel && sel.p === p + 1 && sel.e === ei + 1 && sel.c === c;
                        return (
                          <button
                            key={c}
                            onClick={() => setSel({ p: p + 1, e: ei + 1, c })}
                            className={`aspect-square rounded-lg border text-xs flex items-center justify-center hover:border-slate-700 ${
                              activo ? 'ring-2 ring-slate-900 border-slate-900' : ''
                            }`}
                            title={`Pasillo ${p + 1} · Estante ${L} · Casilla ${c}`}
                          >
                            C{c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-600">Haz clic en una casilla para ver o agregar contenido.</div>
    </div>
  );
}

Mapa.propTypes = {
  cfg: PropTypes.shape({
    pasillos: PropTypes.number.isRequired,
    estantesPorPasillo: PropTypes.number.isRequired,
    casillasPorEstante: PropTypes.number.isRequired,
  }).isRequired,
  letrasEstantes: PropTypes.arrayOf(PropTypes.string).isRequired,
  casillas: PropTypes.arrayOf(PropTypes.number).isRequired,
  sel: PropTypes.shape({
    p: PropTypes.number,
    e: PropTypes.number,
    c: PropTypes.number,
  }),
  setSel: PropTypes.func.isRequired,
};

export default Mapa;
