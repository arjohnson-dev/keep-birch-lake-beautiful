import { BiSolidCartAlt } from "react-icons/bi";

function HeaderCartButton({ count, onOpen }) {
  return (
    <button
      type="button"
      className="header-cart-button"
      onClick={onOpen}
      aria-label={`Open cart with ${count} ${count === 1 ? "item" : "items"}`}
    >
      <span aria-hidden="true" className="header-cart-button__icon">
        <BiSolidCartAlt />
      </span>
      <span className="header-cart-button__badge" aria-live="polite">
        {count}
      </span>
    </button>
  );
}

export default HeaderCartButton;
