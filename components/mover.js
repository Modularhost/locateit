import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

function Mover({ it, cfg, onMove }) {
  const [p, setP] = useState(it.ubicacion.p);
  const [e, setE] = useState(it.ubicacion.e);
  const [c, setC] = useState(it.ubicacion.c);

  useEffect(() => {
    setP(it.ubicacion.p);
    setE(it.ubicacion.e);
    setC(it.ubicacion.c);
  }, [it.id]);

  return (
    <div className="flex items-center gap-1 text-xs">
      <select
        className="border rounded-lg px-2 py-1"
        value={p}
        onChange={(ev) => setP(Number(ev.target.value))}
      >
        {Array.from({ length: cfg.pasillos }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            P{i + 1}
          </option>
        ))}
      </select>
      <select
        className="border rounded-lg px-2 py-1"
        value={e}
        onChange={(ev) => setE(Number(ev.target.value))}
      >
        {Array.from({ length: cfg.estantesPorPasillo }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            E{String.fromCharCode(65 + i)}
          </option>
        ))}
      </select>
      <select
        className="border rounded-lg px-2 py-1"
        value={c}
        onChange={(ev) => setC(Number(ev.target.value))}
      >
        {Array.from({ length: cfg.casillasPorEstante }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            C{i + 1}
          </option>
        ))}
      </select>
      <button
        onClick={() => onMove(it.id, { p, e, c })}
        className="px-2 py-1 border rounded-lg hover:bg-slate-50"
      >
        Mover
      </button>
    </div>
  );
}

Mover.propTypes = {
  it: PropTypes.shape({
    id: PropTypes.string.isRequired,
    ubicacion: PropTypes.shape({
      p: PropTypes.number.isRequired,
      e: PropTypes.number.isRequired,
      c: PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
  cfg: PropTypes.shape({
    pasillos: PropTypes.number.isRequired,
    estantesPorPasillo: PropTypes.number.isRequired,
    casillasPorEstante: PropTypes.number.isRequired,
  }).isRequired,
  onMove: PropTypes.func.isRequired,
};

export default Mover;
