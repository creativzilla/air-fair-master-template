// Local images that also exist as a smaller .webp next to the original
// (generated from the originals, which are kept). CMS content still stores
// the original path; optimizedSrc() swaps in the .webp when one exists.
const WEBP = new Set([
  "/srrv-retire-paradise-2.png",
  "/header-rizal-park.png",
  "/airfair_logo_colored.png",
  "/bi-logo-v2.png",
  "/dole-logo-v2.png",
  "/pra-logo-v2.png",
  "/visa-icon.png",
  "/travel-tours-icon.png",
  "/travel-posters/bali-indonesia.jpg",
  "/travel-posters/bts-airang-package.jpg",
  "/travel-posters/danang-package-tour.jpg",
  "/travel-posters/dubai-uae.jpg",
  "/travel-posters/hong-kong-saver-getaway.jpg",
  "/travel-posters/jeju-island-discovery.jpg",
  "/travel-posters/seoul-south-korea.jpg",
  "/travel-posters/singapore-package.jpg",
  "/travel-posters/singapore-saver-getaway.jpg",
  "/travel-posters/sydney-australia.jpg",
  "/travel-posters/tokyo-japan.jpg",
  "/travel-posters/toronto-canada.jpg",
  "/visa-posters/australia.jpg",
  "/visa-posters/canada.jpg",
  "/visa-posters/japan.jpg",
  "/visa-posters/schengen.jpg",
  "/visa-posters/singapore.jpg",
  "/visa-posters/south-korea.jpg",
  "/visa-posters/uk.jpg",
  "/visa-posters/us.jpg",
]);

export function optimizedSrc(src) {
  return typeof src === "string" && WEBP.has(src) ? src.replace(/\.(png|jpe?g)$/i, ".webp") : src;
}
