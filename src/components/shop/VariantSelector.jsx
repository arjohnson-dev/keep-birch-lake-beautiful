function OptionField({ id, label, value, onChange, options, disabled, required }) {
  return (
    <label className="variant-selector__field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function VariantSelector({ category, options, selection, onChange }) {
  return (
    <div className="variant-selector" aria-live="polite">
      {category === "apparel" ? (
        <>
          <OptionField
            id="garment-select"
            label="Garment"
            value={selection.garment}
            options={options.garments}
            onChange={(garment) => onChange({ ...selection, garment })}
            required
          />
          <OptionField
            id="design-select"
            label="Design"
            value={selection.design}
            options={options.designs}
            onChange={(design) => onChange({ ...selection, design })}
            required
          />
          <OptionField
            id="size-select"
            label="Size"
            value={selection.size}
            options={options.sizes}
            onChange={(size) => onChange({ ...selection, size })}
            required
          />
        </>
      ) : (
        <OptionField
          id="print-design-select"
          label="Design"
          value={selection.design}
          options={options.designs}
          onChange={(design) => onChange({ ...selection, design })}
          required
        />
      )}
    </div>
  );
}

export default VariantSelector;
