import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Busqueda from './Busqueda';
import Mover from './Mover';
import { clamp } from '../utils';

function ListaItems({ items, q, setQ, moverItem, borrarItem, cfg, letrasEstantes, onVaciarTodo }) {
  const [pag, setPag] = useState(1);
  const porPag = 15;
  const totalPag = Math.max(1, Math.ceil(items.length / porPag));
  const pageItems = items.slice((pag - 1) * porPag, pag * porPag);

  useEffect(() => {
    if (pag > totalPag) setPag(totalPag);
  }, [items, totalPag]);

  const ubicStr = (u) => `P${u.p}-E${letrasEstantes[u.e - 1]}-C${u.c}`;

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">Todos los items ({items.length})</h2>
        <Busqueda q={q} setQ={setQ} />
      </div>
      <div className="overflow-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <Th>Nombre</Th>
              <Th>Descripción</Th>
              <Th>Etiquetas</Th>
              <Th>Ubicación</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageItems.map((it) => (
              <tr key={it.id}>
                <Td className="font-medium">{it.nombre}</Td>
                <Td>{it.descripcion}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {it.tags?.map((t) => (
                      <span key={t} className="px-2 py-0.5 border rounded-full">
                        #{t}
                      </span>
                    ))}
                  </div>
                </Td>
                <Td>{ubicStr(it.ubicacion)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Mover it={it} cfg={cfg} onMove={moverItem} />
                    <button
                      onClick={() => borrarItem(it.id)}
                      className="px-2 py-1 border rounded-lg hover:bg-slate-50"
                    >
                      Borrar
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-slate-600">Página {pag} de {totalPag}</div>
        <div className="flex gap-2">
          <button
            onClick={() => setPag((p) => clamp(p - 1, 1, totalPag))}
            className="px-3 py-1.5 border rounded-lg"
          >
            Anterior
          </button>
          <button
            onClick={() => setPag((p) => clamp(p + 1, 1, totalPag))}
            className="px-3 py-1.5 border rounded-lg"
          >
            Siguiente
          </button>
        </div>
      </div>
      <div className="mt-4">
        <button onClick={onVaciarTodo} className="px-3 py-2 border rounded-xl">
          Vaciar todo
        </button>
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="text-left px-3 py-2 font-medium">{children}</th>;
}

function Td({ children, className = '' }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

ListaItems.propTypes = {
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
  q: PropTypes.string.isRequired,
  setQ: PropTypes.func.isRequired,
  moverItem: PropTypes.func.isRequired,
  borrarItem: PropTypes.func.isRequired,
  cfg: PropTypes.shape({
    pasillos: PropTypes.number.isRequired,
    estantesPorPasillo: PropTypes.number.isRequired,
    casillasPorEstante: PropTypes.number.isRequired,
  }).isRequired,
  letrasEstantes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onVaciarTodo: PropTypes.func.isRequired,
};

Th.propTypes = {
  children: PropTypes.node.isRequired,
};

Td.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default ListaItems;
