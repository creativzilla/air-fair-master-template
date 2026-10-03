// Centralized configuration for the Travel & Tours pages — the hub/listing
// page and every individual package detail page.
//
// The page templates (TravelToursPage, TravelPackageDetailPage, and their
// section components) never change. To add a destination or package, add
// ONE entry to the relevant array below — no component changes needed.

// Each destination links to the travel package that covers it — its
// "dedicated page" until standalone destination pages exist.
export const travelDestinations = [
  {
    name: "Japan",
    slug: "japan",
    packageSlug: "tokyo-japan",
    region: "Asia",
    shortDescription: "Culture, Food, and Unforgettable Views",
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "South Korea",
    slug: "south-korea",
    packageSlug: "seoul-south-korea",
    region: "Asia",
    shortDescription: "K-Culture, Cities and More",
    image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Singapore",
    slug: "singapore",
    packageSlug: "singapore-package",
    region: "Asia",
    shortDescription: "Modern City, Endless Experiences",
    image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Australia",
    slug: "australia",
    packageSlug: "sydney-australia",
    region: "Oceania",
    shortDescription: "Stunning Cities and Natural Wonders",
    image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Canada",
    slug: "canada",
    packageSlug: "toronto-canada",
    region: "North America",
    shortDescription: "Breathtaking Landscapes All Year Round",
    image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=800&q=80",
  },
];

function defaultPackageFaqs(place) {
  return [
    { question: "What is included in this package?", answer: "Flights, hotel accommodation, and guided tours are included — see the \"What's Included\" section above for the full list." },
    { question: "Can I customize this itinerary?", answer: `Yes. Let us know your preferences and our travel team will help tailor your ${place} trip.` },
    { question: "What is the best time to visit?", answer: "This varies by season — our travel specialists can recommend the best time to go based on your preferences." },
    { question: "Do I need a visa to travel here?", answer: "This depends on your nationality. Our team can help you check your visa requirements before booking." },
    { question: "How do I reserve this package?", answer: "Fill out the inquiry form and our travel specialists will get in touch to confirm your booking details." },
  ];
}

function defaultInquiryFields() {
  return [
    { name: "fullName", label: "Full Name", type: "text", required: true, placeholder: "Enter your full name" },
    { name: "email", label: "Email Address", type: "email", required: true, placeholder: "Enter your email address" },
    { name: "phone", label: "Phone Number", type: "tel", required: true, placeholder: "+63 912 345 6789" },
    { name: "travelDate", label: "Preferred Travel Date", type: "date", required: true },
    {
      name: "travelers",
      label: "Number of Travelers",
      type: "select",
      required: true,
      options: ["1 Traveler", "2 Travelers", "3 Travelers", "4 Travelers", "5+ Travelers"],
    },
    {
      name: "packageType",
      label: "Package Type",
      type: "select",
      required: true,
      options: ["Standard Package", "Premium Package", "Custom Package"],
    },
    { name: "message", label: "Additional Message (Optional)", type: "textarea", required: false, placeholder: "Tell us more about your travel plans or special requests." },
  ];
}

export const travelPackages = [
  {
    title: "Bali, Indonesia",
    slug: "bali-indonesia",
    featured: true,
    image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=800&q=80",
    duration: "5D 4N",
    inclusions: [
      { icon: "plane", label: "Flight" },
      { icon: "home", label: "Hotel" },
      { icon: "users", label: "Tours" },
    ],
    price: "₱34,999",
    subtitle: "Island of Beauty and Endless Adventures",
    description:
      "Discover Bali's stunning beaches, rich culture, and unforgettable experiences. From serene temples and lush landscapes to vibrant local life, this package offers the perfect mix of relaxation, adventure, and cultural discovery.",
    heroBadge: { title: "Ulun Danu Beratan Temple", subtitle: "Bali, Indonesia" },
    aboutParagraphs: [
      "Bali, Indonesia is one of the world's most popular travel destinations, known for its beautiful beaches, crystal-clear waters, vibrant culture, and warm hospitality. Whether you're looking to relax, explore ancient temples, enjoy world-class cuisine, or seek thrilling adventures, Bali offers something for everyone.",
    ],
    packageHighlights: [
      { image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80", title: "Stunning Beaches", description: "Relax at Bali's famous beaches like Kuta, Seminyak, and Nusa Dua." },
      { image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=700&q=80", title: "Iconic Temples", description: "Visit cultural landmarks such as Tanah Lot and Uluwatu Temple." },
      { image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=700&q=80", title: "Rice Terraces", description: "Explore the scenic Tegallalang rice terraces." },
      { image: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=700&q=80", title: "Natural Adventures", description: "Discover breathtaking waterfalls and lush landscapes." },
    ],
    whatsIncluded: [
      "Round-trip flights",
      "4 nights hotel accommodation",
      "Daily breakfast",
      "Guided temple and rice terrace tour",
      "Airport transfers",
    ],
    faqs: defaultPackageFaqs("Bali"),
    relatedCard: {
      title: "Explore More Destinations",
      description: "Discover other amazing places and travel packages.",
      image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=800&q=80",
      ctaLabel: "View All Packages",
      ctaHref: "/travel-tours",
    },
    inquiryForm: { fields: defaultInquiryFields() },
    seo: {
      title: "Bali, Indonesia Travel Package | Airfair Travel and Tours",
      description: "Book your Bali getaway with Airfair — flights, hotel, and guided tours included.",
    },
  },
  {
    title: "Tokyo, Japan",
    slug: "tokyo-japan",
    featured: true,
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
    duration: "5D 4N",
    inclusions: [
      { icon: "plane", label: "Flight" },
      { icon: "home", label: "Hotel" },
      { icon: "users", label: "Tours" },
    ],
    price: "₱49,999",
    subtitle: "Where Tradition Meets Modern Life",
    description:
      "Experience Tokyo's dazzling energy — from neon-lit streets and world-class cuisine to historic temples and serene gardens. This package blends the best of modern and traditional Japan.",
    heroBadge: { title: "Shibuya Crossing", subtitle: "Tokyo, Japan" },
    aboutParagraphs: [
      "Tokyo is a city of contrasts — ultramodern skyscrapers and neon streets sit alongside centuries-old temples and quiet gardens. This package gives you a well-rounded taste of the city's culture, food, and energy.",
    ],
    packageHighlights: [
      { image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=700&q=80", title: "Shibuya & Shinjuku", description: "Explore Tokyo's most iconic modern districts." },
      { image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=700&q=80", title: "Traditional Temples", description: "Visit historic shrines and peaceful gardens." },
      { image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80", title: "Local Cuisine", description: "Sample authentic Japanese food and street eats." },
      { image: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=700&q=80", title: "Day Trips", description: "Optional excursions beyond the city." },
    ],
    whatsIncluded: [
      "Round-trip flights",
      "4 nights hotel accommodation",
      "Daily breakfast",
      "Guided city tour",
      "Airport transfers",
    ],
    faqs: defaultPackageFaqs("Tokyo"),
    relatedCard: {
      title: "Explore More Destinations",
      description: "Discover other amazing places and travel packages.",
      image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=800&q=80",
      ctaLabel: "View All Packages",
      ctaHref: "/travel-tours",
    },
    inquiryForm: { fields: defaultInquiryFields() },
    seo: {
      title: "Tokyo, Japan Travel Package | Airfair Travel and Tours",
      description: "Book your Tokyo adventure with Airfair — flights, hotel, and guided tours included.",
    },
  },
  {
    title: "Seoul, South Korea",
    slug: "seoul-south-korea",
    featured: true,
    image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=800&q=80",
    duration: "5D 4N",
    inclusions: [
      { icon: "plane", label: "Flight" },
      { icon: "home", label: "Hotel" },
      { icon: "users", label: "Tours" },
    ],
    price: "₱46,999",
    subtitle: "K-Culture, Cities, and Timeless Palaces",
    description:
      "Explore Seoul's mix of royal palaces, vibrant shopping districts, and modern K-culture. This package covers the city's must-see sights and local experiences.",
    heroBadge: { title: "Gyeongbokgung Palace", subtitle: "Seoul, South Korea" },
    aboutParagraphs: [
      "Seoul blends centuries-old palaces with cutting-edge fashion, entertainment, and cuisine. This package covers the city's top sights along with time to explore its trendy neighborhoods.",
    ],
    packageHighlights: [
      { image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=700&q=80", title: "Historic Palaces", description: "Visit Seoul's iconic royal palaces." },
      { image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=700&q=80", title: "City Nightlife", description: "Experience Seoul's vibrant city lights." },
      { image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80", title: "Local Markets", description: "Shop and eat at Seoul's famous markets." },
      { image: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=700&q=80", title: "Day Trips", description: "Optional excursions outside the city." },
    ],
    whatsIncluded: [
      "Round-trip flights",
      "4 nights hotel accommodation",
      "Daily breakfast",
      "Guided city tour",
      "Airport transfers",
    ],
    faqs: defaultPackageFaqs("Seoul"),
    relatedCard: {
      title: "Explore More Destinations",
      description: "Discover other amazing places and travel packages.",
      image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
      ctaLabel: "View All Packages",
      ctaHref: "/travel-tours",
    },
    inquiryForm: { fields: defaultInquiryFields() },
    seo: {
      title: "Seoul, South Korea Travel Package | Airfair Travel and Tours",
      description: "Book your Seoul getaway with Airfair — flights, hotel, and guided tours included.",
    },
  },
  {
    title: "Singapore",
    slug: "singapore-package",
    featured: true,
    image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80",
    duration: "4D 3N",
    inclusions: [
      { icon: "plane", label: "Flight" },
      { icon: "home", label: "Hotel" },
      { icon: "users", label: "Tours" },
    ],
    price: "₱39,999",
    subtitle: "Modern City, Endless Experiences",
    description:
      "From Marina Bay's skyline to Sentosa's beaches and world-famous street food, this package showcases the very best of Singapore in just a few days.",
    heroBadge: { title: "Marina Bay Sands", subtitle: "Singapore" },
    aboutParagraphs: [
      "Singapore packs gardens, gleaming skylines, island beaches, and incredible food into one compact city. This package covers its top attractions with time to explore at your own pace.",
    ],
    packageHighlights: [
      { image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=700&q=80", title: "Marina Bay Sands", description: "See Singapore's most iconic skyline view." },
      { image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=700&q=80", title: "Gardens by the Bay", description: "Explore the futuristic Supertree Grove." },
      { image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80", title: "Local Hawker Food", description: "Taste Singapore's famous street food." },
      { image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=700&q=80", title: "Sentosa Island", description: "Relax at the beaches and attractions." },
    ],
    whatsIncluded: [
      "Round-trip flights",
      "3 nights hotel accommodation",
      "Daily breakfast",
      "Guided city tour",
      "Airport transfers",
    ],
    faqs: defaultPackageFaqs("Singapore"),
    relatedCard: {
      title: "Explore More Destinations",
      description: "Discover other amazing places and travel packages.",
      image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=800&q=80",
      ctaLabel: "View All Packages",
      ctaHref: "/travel-tours",
    },
    inquiryForm: { fields: defaultInquiryFields() },
    seo: {
      title: "Singapore Travel Package | Airfair Travel and Tours",
      description: "Book your Singapore getaway with Airfair — flights, hotel, and guided tours included.",
    },
  },
  {
    title: "Dubai, UAE",
    slug: "dubai-uae",
    featured: true,
    image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=800&q=80",
    duration: "5D 4N",
    inclusions: [
      { icon: "plane", label: "Flight" },
      { icon: "home", label: "Hotel" },
      { icon: "users", label: "Tours" },
    ],
    price: "₱56,999",
    subtitle: "Luxury, Desert, and Skyline Adventures",
    description:
      "Experience Dubai's towering skyline, luxury shopping, and thrilling desert adventures. This package covers the city's must-see icons and unique experiences.",
    heroBadge: { title: "Burj Khalifa", subtitle: "Dubai, UAE" },
    aboutParagraphs: [
      "Dubai combines record-breaking modern architecture with rich Emirati culture and desert landscapes just outside the city. This package covers its top sights and experiences.",
    ],
    packageHighlights: [
      { image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=700&q=80", title: "Burj Khalifa", description: "Visit the world's tallest building." },
      { image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=700&q=80", title: "Downtown Dubai", description: "Explore the modern city skyline." },
      { image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80", title: "Desert Safari", description: "Experience dune bashing and desert camps." },
      { image: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=700&q=80", title: "Old Dubai", description: "Discover traditional souks and culture." },
    ],
    whatsIncluded: [
      "Round-trip flights",
      "4 nights hotel accommodation",
      "Daily breakfast",
      "Desert safari with dinner",
      "Airport transfers",
    ],
    faqs: defaultPackageFaqs("Dubai"),
    relatedCard: {
      title: "Explore More Destinations",
      description: "Discover other amazing places and travel packages.",
      image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=800&q=80",
      ctaLabel: "View All Packages",
      ctaHref: "/travel-tours",
    },
    inquiryForm: { fields: defaultInquiryFields() },
    seo: {
      title: "Dubai, UAE Travel Package | Airfair Travel and Tours",
      description: "Book your Dubai getaway with Airfair — flights, hotel, and guided tours included.",
    },
  },
  {
    title: "Sydney, Australia",
    slug: "sydney-australia",
    featured: false,
    image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=800&q=80",
    duration: "6D 5N",
    inclusions: [
      { icon: "plane", label: "Flight" },
      { icon: "home", label: "Hotel" },
      { icon: "users", label: "Tours" },
    ],
    price: "₱58,999",
    subtitle: "Stunning Cities and Natural Wonders",
    description:
      "Discover Sydney's iconic harbor, sun-soaked beaches, and vibrant city life. This package covers Australia's most famous sights along with time to explore its natural wonders.",
    heroBadge: { title: "Sydney Opera House", subtitle: "Sydney, Australia" },
    aboutParagraphs: [
      "Sydney pairs a world-famous harbor and opera house with golden beaches and lush national parks nearby. This package covers the city's top attractions with time to relax by the coast.",
    ],
    packageHighlights: [
      { image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=700&q=80", title: "Sydney Opera House", description: "See Australia's most iconic landmark." },
      { image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=700&q=80", title: "Harbour Bridge", description: "Walk or climb Sydney's famous bridge." },
      { image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80", title: "Bondi Beach", description: "Relax at one of Australia's top beaches." },
      { image: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=700&q=80", title: "Blue Mountains", description: "Explore stunning natural scenery nearby." },
    ],
    whatsIncluded: [
      "Round-trip flights",
      "5 nights hotel accommodation",
      "Daily breakfast",
      "Guided city and harbour tour",
      "Airport transfers",
    ],
    faqs: defaultPackageFaqs("Sydney"),
    relatedCard: {
      title: "Explore More Destinations",
      description: "Discover other amazing places and travel packages.",
      image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=800&q=80",
      ctaLabel: "View All Packages",
      ctaHref: "/travel-tours",
    },
    inquiryForm: { fields: defaultInquiryFields() },
    seo: {
      title: "Sydney, Australia Travel Package | Airfair Travel and Tours",
      description: "Book your Sydney getaway with Airfair — flights, hotel, and guided tours included.",
    },
  },
  {
    title: "Toronto, Canada",
    slug: "toronto-canada",
    featured: false,
    image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=800&q=80",
    duration: "6D 5N",
    inclusions: [
      { icon: "plane", label: "Flight" },
      { icon: "home", label: "Hotel" },
      { icon: "users", label: "Tours" },
    ],
    price: "₱62,999",
    subtitle: "Breathtaking Landscapes All Year Round",
    description:
      "From the CN Tower's skyline views to the thundering waters of Niagara Falls, this package covers Toronto's best city sights and natural wonders nearby.",
    heroBadge: { title: "CN Tower", subtitle: "Toronto, Canada" },
    aboutParagraphs: [
      "Toronto offers a lively, multicultural city experience with easy access to some of Canada's most breathtaking natural landscapes. This package covers the city's highlights along with a trip to Niagara Falls.",
    ],
    packageHighlights: [
      { image: "https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=700&q=80", title: "CN Tower", description: "Enjoy panoramic views of Toronto." },
      { image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=700&q=80", title: "Niagara Falls", description: "Visit one of the world's most iconic waterfalls." },
      { image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80", title: "Distillery District", description: "Explore Toronto's historic arts district." },
      { image: "https://images.unsplash.com/photo-1710917554876-9e2ada25f7b4?auto=format&fit=crop&w=700&q=80", title: "City Waterfront", description: "Stroll along Toronto's scenic waterfront." },
    ],
    whatsIncluded: [
      "Round-trip flights",
      "5 nights hotel accommodation",
      "Daily breakfast",
      "Guided city and Niagara Falls tour",
      "Airport transfers",
    ],
    faqs: defaultPackageFaqs("Toronto"),
    relatedCard: {
      title: "Explore More Destinations",
      description: "Discover other amazing places and travel packages.",
      image: "https://images.unsplash.com/photo-1750941416707-4dff777c67b1?auto=format&fit=crop&w=800&q=80",
      ctaLabel: "View All Packages",
      ctaHref: "/travel-tours",
    },
    inquiryForm: { fields: defaultInquiryFields() },
    seo: {
      title: "Toronto, Canada Travel Package | Airfair Travel and Tours",
      description: "Book your Toronto getaway with Airfair — flights, hotel, and guided tours included.",
    },
  },
];

export const homepageTravelPackages = [
  { slug: "bts-airang-package", name: "BTS Airang Package", place: "Kuala Lumpur", flagCode: "my", price: "Starts at ₱45,288", image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=600&q=80" },
  { slug: "hong-kong-saver-getaway", name: "Hong Kong Saver Getaway", place: "Hong Kong", flagCode: "hk", price: "Starts at ₱30,876", image: "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?auto=format&fit=crop&w=600&q=80" },
  { slug: "singapore-saver-getaway", name: "Singapore Saver Getaway", place: "Singapore", flagCode: "sg", price: "Starts at ₱32,788", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=600&q=80" },
  { slug: "danang-package-tour", name: "Danang Package Tour", place: "Vietnam", flagCode: "vn", price: "Starts at $799", image: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=600&q=80" },
  { slug: "jeju-island-discovery", name: "Jeju Island Discovery", place: "South Korea", flagCode: "kr", price: "Starts at $959", image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=600&q=80" },
];

// Additional destination photos for the homepage offers' thumbnail galleries.
const homepageGalleryPhotos = {
  "bts-airang-package": "photo-1552353290-f2a1ff0b5009", // Batu Caves — Laurentiu Morariu
  "hong-kong-saver-getaway": "photo-1765984939425-4b653e6e2c6e", // Victoria Harbour — Raymond Yeung
  "singapore-saver-getaway": "photo-1485257334450-84ec1ba6393d", // Supertree Grove — Annie Spratt
  "danang-package-tour": "photo-1723142282970-1fd415eec1ad", // My Khe Beach — Jess Silaya
  "jeju-island-discovery": "photo-1581610533395-f3dc786a6979", // Jeju coast — insung yoon
};

const homepagePackageDetails = homepageTravelPackages.map(offer => ({
  ...offer,
  title: offer.name,
  subtitle: `${offer.place} ? ${offer.price}`,
  description: `Explore ${offer.place} with the ${offer.name}. Contact our travel team for departure dates, the full itinerary, and availability.`,
  gallery: [offer.image, `https://images.unsplash.com/${homepageGalleryPhotos[offer.slug]}?auto=format&fit=crop&w=1200&q=80`],
  aboutParagraphs: [`Plan your ${offer.place} getaway with our travel team. Share your preferred dates and number of travelers to receive the itinerary and a personalized quote for this offer.`],
  aboutDetails: offer.slug === "bts-airang-package" ? [
    { label: "Destination", value: "Kuala Lumpur, Malaysia" },
    { label: "Starting Price", value: "₱45,288 per person" },
    { label: "Package Type", value: "Flight + Hotel + Tours" },
    { label: "Ideal For", value: "Couples, families, friends, and group travelers" },
    { label: "Package Inclusions", value: "roundtrip airfare, hotel accommodation, daily breakfast, airport transfers" },
    { label: "Optional Add-ons", value: "visa assistance, travel insurance, guided tours" },
    { label: "Booking Notes", value: "final itinerary, departure dates, and availability are shared upon inquiry" },
    { label: "Recommended For", value: "travelers looking for a city getaway with sightseeing, shopping, and food experiences" },
  ] : [],
  packageHighlights: [],
  whatsIncluded: [],
  faqs: [
    { question: "What is the starting price?", answer: `${offer.price}. Our team will confirm the final quote for your preferred travel dates and group size.` },
    { question: "What is included and how long is the trip?", answer: "Contact our travel team for this offer's confirmed duration, itinerary, and inclusions." },
    { question: "How do I reserve this package?", answer: "Complete the inquiry form on this page. Our travel team will contact you with availability and booking details." },
  ],
  inquiryForm: { fields: defaultInquiryFields() },
  seo: { title: `${offer.name} | Air Fair Travel & Tours` },
}));

export function getTravelPackage(slug) {
  return travelPackages.find(item => item.slug === slug)
    || homepagePackageDetails.find(item => item.slug === slug)
    || null;
}
