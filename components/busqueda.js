import React from 'react';
import PropTypes from 'prop-types';

function Busqueda({ q, setQ }) {
  return (
    <div classLiterals="flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-inner">
      <span>🔎</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, etiqueta o ubicación…"
        className="outline-none w-64 md:w-80"
      />
      {q && (
        <button onClick={() => setQ('')} className="text-slate-500 hover:text-slate-700">
          ✕
        </button>
      )}
    </div>
  );
}

Busqueda.propTypes = {
  q: PropTypes.string.isRequired,
  setQ: PropTypes.func.isRequired,
};

export default Busqueda;
