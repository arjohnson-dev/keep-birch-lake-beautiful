function AddToCartButton({ disabled, onClick, added }) {
  return (
    <button
      type="button"
      className="shop-add-button"
      onClick={onClick}
      disabled={disabled}
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}

export default AddToCartButton;
