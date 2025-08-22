import React from 'react';
import PropTypes from 'prop-types';

function Num({ label, value, onChange, min = 1, max = 100 }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="px-3 py-2 border rounded-xl"
      />
    </label>
  );
}

Num.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
};

export default Num;
