import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Num from './Num';

function Ajustes({ cfg, setCfg, letrasEstantes }) {
  const [local, setLocal] = useState(cfg);

  useEffect(() => setLocal(cfg), [cfg]);

  const aplicar = () => {
    setCfg({
      pasillos: clamp(Number(local.pasillos) || 1, 1, 50),
      estantesPorPasillo: clamp(Number(local.estantesPorPasillo) || 1, 1, 26),
      casillasPorEstante: clamp(Number(local.casillasPorEstante) || 1, 1, 200),
    });
  };

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <h2 className="text-xl font-semibold mb-3">Ajustar estructura de la bodega</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Num
          label="Pasillos"
          value={local.pasillos}
          onChange={(v) => setLocal({ ...local, pasillos: v })}
          min={1}
          max={50}
        />
        <Num
          label="Estantes por pasillo"
          value={local.estantesPorPasillo}
          onChange={(v) => setLocal({ ...local, estantesPorPasillo: v })}
          min={1}
          max={26}
        />
        <Num
          label="Casillas por estante"
          value={local.casillasPorEstante}
          onChange={(v) => setLocal({ ...local, casillasPorEstante: v })}
          min={1}
          max={200}
        />
      </div>
      <div className="mt-3 text-sm text-slate-600">
        Estantes se nombrarán: {letrasEstantes.join(', ') || '(ninguno)'}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={aplicar} className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:opacity-90">
          Aplicar cambios
        </button>
        <button onClick={() => setLocal(cfg)} className="px-3 py-2 border rounded-xl bg-white">
          Revertir
        </button>
      </div>
    </div>
  );
}

Ajustes.propTypes = {
  cfg: PropTypes.shape({
    pasillos: PropTypes.number.isRequired,
    estantesPorPasillo: PropTypes.number.isRequired,
    casillasPorEstante: PropTypes.number.isRequired,
  }).isRequired,
  setCfg: PropTypes.func.isRequired,
  letrasEstantes: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default Ajustes;
