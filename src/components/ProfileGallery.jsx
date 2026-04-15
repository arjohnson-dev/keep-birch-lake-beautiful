function ProfileGallery({ images, title, variant = "grid", onImageClick }) {
  return (
    <div
      className={`profile-gallery profile-gallery--${variant}`}
      aria-label={title}
    >
      {images.map((image, index) => (
        <figure key={image.src} className="profile-gallery__item">
          <button
            type="button"
            className="profile-gallery__trigger"
            onClick={() => onImageClick?.(index)}
            aria-label={`Open ${image.alt}`}
          >
            <img src={image.src} alt={image.alt} />
          </button>
        </figure>
      ))}
    </div>
  );
}

export default ProfileGallery;
