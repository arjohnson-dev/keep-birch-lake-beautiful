import { useState } from "react";
import ProfileGallery from "../components/ProfileGallery.jsx";
import ExpandableGalleryLightbox from "../components/ExpandableGalleryLightbox.jsx";
import "./AboutView.css";

const phyllisImages = [
  {
    src: "/phyllis/phyllis.jpg",
    alt: "Portrait of Phyllis Rasmussen",
  },
  {
    src: "/phyllis/phyllis-1.jpg",
    alt: "Phyllis Rasmussen outdoors",
  },
  {
    src: "/phyllis/phyllis-group.jpg",
    alt: "Phyllis Rasmussen with family and friends",
  },
];

const coyHeadshotImage = {
  src: "/coy/coy-headshot.jpg",
  alt: "Headshot of Coy Jankowski",
};

const coyArtworkImages = [
  {
    src: "/coy/coy-art.jpg",
    alt: "Coy Jankowski artwork",
  },
  {
    src: "/coy/coy-crane.jpg",
    alt: "Coy Jankowski painting of a crane",
  },
  {
    src: "/coy/coy-flowers.jpg",
    alt: "Coy Jankowski floral painting",
  },
  {
    src: "/coy/coy-eagle.jpg",
    alt: "Coy Jankowski eagle painting",
  },
  {
    src: "/coy/coy-nd.jpg",
    alt: "Coy Jankowski artwork",
  },
  {
    src: "/coy/coy-nd-1.jpg",
    alt: "Coy Jankowski artwork",
  },
];

function AboutView() {
  const allAboutImages = [...phyllisImages, coyHeadshotImage, ...coyArtworkImages];
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const openGallery = (index) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const closeGallery = () => setGalleryOpen(false);
  const showNext = () =>
    setGalleryIndex((index) => (index + 1) % allAboutImages.length);
  const showPrev = () =>
    setGalleryIndex(
      (index) => (index - 1 + allAboutImages.length) % allAboutImages.length,
    );

  return (
    <section id="about" className="view">
      <div className="section-heading">
        <p className="eyebrow">About us</p>
        <h2>The people behind Keep Birch Lake Beautiful.</h2>
      </div>

      <div className="profile-list">
        <article id="phyllis" className="profile-card">
          <div className="profile-card__header">
            <p className="eyebrow">Founder</p>
            <h3>Phyllis Rasmussen</h3>
          </div>

          <div className="profile-card__media">
            <ProfileGallery
              images={phyllisImages}
              title="Photos of Phyllis Rasmussen"
              variant="founder"
              onImageClick={(index) => openGallery(index)}
            />
          </div>

          <div className="profile-card__content">
            <div className="profile-card__body">
              <p>
                Phyllis Rasmussen is the woman behind the “Keep Birch Lake
                Beautiful” project. Her parents, Linda and Buzz Rasmussen, have
                lived year-round on the west side of Birch Lake for over 43
                years. From a young age, Phyllis spent her time catching
                turtles, chasing frogs, and enjoying everything the lake had to
                offer, making it her favorite place to be.
              </p>
              <p>
                Phyllis now lives near Grand Rapids, Michigan with her wife,
                Ciara Rasmussen. She works remotely in Medical Education
                Admissions, while Ciara works for the Gun Lake Tribe Utility
                Authority. Despite living away from the lake, Phyllis&apos;s
                deep connection to Birch Lake remains a central part of her
                life.
              </p>
              <p>
                The “Keep Birch Lake Beautiful” project was born out of her
                passion for preserving the lake and ensuring others can continue
                to enjoy it. She is dedicated to keeping the shoreline clean,
                picking up trash, and finding new ways to support and elevate
                the natural environment. What once felt like a childhood luxury
                has become, in her adult years, something she recognizes as a
                true blessing, an oasis she never takes for granted.
              </p>
              <p>
                Phyllis especially cherishes the quiet moments Birch Lake
                offers: the stillness of early mornings, the glow of sunsets,
                the warmth of bonfires, and even the sound of storms rolling in,
                her favorite weather for the perfect nap. These experiences
                continue to fuel her commitment to protecting the lake for
                future generations.
              </p>
              <p>
                Through the sale of clothing and art prints, Phyllis raises
                funds to support the Birch Lake water quality initiative. This
                effort is made possible by families of all sizes who share a
                love for the lake and a desire to preserve it. Her goal is to
                ensure that Birch Lake remains a place where generations to come
                can experience the same beauty and peace she has known
                throughout her life.
              </p>
              <p>
                She extends sincere thanks to the project&apos;s partners,
                including Birch Lake Water Quality, Coy Jankowski, T-Shirt
                Wonders in Grand Rapids, Michigan, and the many family members
                and friends who supported her in turning this passion project
                into a reality in just a few short weeks.
              </p>
              <p>
                Phyllis is grateful for the support of those who choose to shop
                local and contribute to this meaningful cause. She wishes
                everyone a safe and sunny summer and looks forward to seeing
                familiar faces out on the water.
              </p>
            </div>
          </div>
        </article>

        <article id="coy" className="profile-card">
          <div className="profile-card__header">
            <p className="eyebrow">Artist</p>
            <h3>Coy Jankowski</h3>
          </div>

          <div className="profile-card__media">
            <figure className="artist-headshot">
              <img
                src={coyHeadshotImage.src}
                alt={coyHeadshotImage.alt}
              />
            </figure>
          </div>

          <div className="profile-card__content">
            <div className="profile-card__gallery">
              <ProfileGallery
                images={coyArtworkImages}
                title="Artwork by Coy Jankowski"
                variant="artist"
                onImageClick={(index) =>
                  openGallery(index + phyllisImages.length + 1)
                }
              />
            </div>

            <div className="profile-card__body">
              <p>
                Coy has been painting original and commissioned art since he was
                in high school, over a five-decade career now, as he has honed
                his craft. He has won national awards, sold his paintings
                internationally throughout his career, and dedicated countless
                hours to mastering his artwork. His father, Zygmund Jankowski, a
                well-known artist, inspired Coy in his career as he drew on
                memories of his childhood sitting and watching his father paint.
              </p>
              <p>
                Coy has always found Birch Lake to be a place of natural beauty
                and enjoyed many summers basking in the sun. His work over the
                last few years has been commission driven of people, places,
                animals, and inspiration, each one more unique than the last.
              </p>
              <p>
                Coy says, “When someone commissions a painting of a loved one
                here or gone, I get involved in a moment in their life that they
                let me see into. People ask me to paint, but they also tell me a
                story, or share a memory, it’s what carries my brush strokes.”
              </p>
              <p>
                Coy says the evolution of his talent has had many growth
                periods. “The way I paint now versus the way I painted forty
                years ago is entirely different, and it will continue to
                evolve.”
              </p>
              <p>
                Coy is based out of his home and always welcomes studio visits
                by appointment.
              </p>
            </div>
          </div>
        </article>
      </div>

      {galleryOpen && (
        <ExpandableGalleryLightbox
          slides={allAboutImages}
          activeIndex={galleryIndex}
          onPrevious={showPrev}
          onNext={showNext}
          onClose={closeGallery}
          ariaLabel="About us gallery"
        />
      )}
    </section>
  );
}

export default AboutView;
