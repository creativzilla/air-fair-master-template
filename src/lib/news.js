// Curated articles: update this list when publishing a new selection of news.
export const stories = [
  {
    slug: "phitex-2026",
    category: "Travel & Events", date: "September 2026", dateTime: "2026-09",
    title: "PHITEX 2026 puts Philippine tourism in the spotlight",
    description: "Connecting local travel businesses with international buyers.",
    source: "Tourism Promotions Board", initials: "TPB", image: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=900&q=85",
    href: "https://tpb.gov.ph/press_releases/tpb-wraps-up-phitex-2026-with-over-php-500-million-in-sales-leads-up-more-than-20-from-2025/",
  },
  {
    slug: "smarter-safer-borders",
    category: "Immigration", date: "September 14, 2026", dateTime: "2026-09-14",
    title: "A new chapter for smarter, safer borders",
    description: "Digital services and more efficient immigration processes.",
    source: "Bureau of Immigration", initials: "BI", logo: "/bi-logo-v2.png", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=85",
    href: "https://immigration.gov.ph/bi-turns-86-charts-path-to-smarter-safer-borders/",
  },
  {
    slug: "sustainable-tourism",
    category: "Tourism News", date: "September 8, 2026", dateTime: "2026-09-08",
    title: "Supporting a more sustainable tourism industry",
    description: "Helping hotels and resorts improve energy efficiency.",
    source: "Department of Energy", initials: "DOE", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=85",
    href: "https://doe.gov.ph/news/press-releases/doe-dot-help-tourism-establishment-cut-energy-costs-improve-efficiency",
  },
  {
    slug: "immigration-roadmap",
    category: "Policy Updates", date: "July 8, 2026", dateTime: "2026-07-08",
    title: "A roadmap for modern immigration services",
    description: "The BI's long-term plan for digital services and efficient public support.",
    source: "Bureau of Immigration", initials: "BI", logo: "/bi-logo-v2.png", image: "/header-rizal-park.png",
    href: "https://immigration.gov.ph/bi-launches-2026-2040-strategy-to-strengthen-border-security-modernize-immigration-services/",
  },
];

export const guides = [
  { category: "Travel & Events", slug: "discover-philippines", title: "Discover more of the Philippines", description: "Explore destinations and find inspiration for your next island escape.", image: stories[0].image, href: "https://philippines.travel/", source: "Philippines Travel" },
  { category: "Immigration", slug: "prepare-for-your-journey", title: "Prepare for your next journey", description: "Find official passport information before planning your trip abroad.", image: stories[1].image, href: "https://consular.dfa.gov.ph/passport", source: "Department of Foreign Affairs" },
  { category: "Tourism News", slug: "responsible-travel", title: "Explore responsible travel", description: "Discover the UN Tourism resources on sustainable tourism.", image: stories[2].image, href: "https://www.unwto.org/sustainable-development", source: "UN Tourism" },
];

export const allArticles = [...stories, ...guides];
