import React, { useState } from 'react';
import PropTypes from 'prop-types';

function NuevoItem({ onAdd }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tags, setTags] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    onAdd({ nombre, descripcion, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
    setNombre('');
    setDescripcion('');
    setTags('');
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del item (obligatorio)"
        className="px-3 py-2 border rounded-xl"
      />
      <input
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Descripción (opcional)"
        className="px-3 py-2 border rounded-xl"
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Etiquetas separadas por coma: herramienta, repuesto"
        className="px-3 py-2 border rounded-xl"
      />
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:opacity-90">
          Agregar
        </button>
        <button
          type="button"
          className="px-3 py-2 border rounded-xl"
          onClick={() => {
            setNombre('');
            setDescripcion('');
            setTags('');
          }}
        >
          Limpiar
        </button>
      </div>
    </form>
  );
}

NuevoItem.propTypes = {
  onAdd: PropTypes.func.isRequired,
};

export default NuevoItem;
