// Destination "card" data for International Tourist Visa Assistance.
// Derived from lib/visaCountries.js (the single source of truth) so the
// homepage teaser, the destination hub page, and the country detail pages
// can never drift out of sync with each other.

import { toDestinationCard, visaCountryList } from "./visaCountries.js";

export const VISA_REGIONS = ["All Destinations", "Europe", "North America", "Asia", "Oceania", "Middle East", "Others"];

// Every configured destination — used by the full /visa-assistance hub page.
export const visaDestinations = visaCountryList.map(toDestinationCard);

// A curated subset for the homepage teaser strip, which is only meant to
// show a handful of popular destinations rather than the full catalog.
export const featuredVisaDestinations = visaDestinations.filter(item => item.featured);
