export const CLIENT_CATEGORIES = [
  "Immigration services",
  "Visa destinations",
  "Travel packages",
  "Special Resident Retiree's Visa",
];

// Keep existing leads searchable under the service category names.
export function clientCategory(category) {
  const aliases = {
    "Immigration Processing": CLIENT_CATEGORIES[0],
    Visa: CLIENT_CATEGORIES[1],
    "Tour Package": CLIENT_CATEGORIES[2],
    SRRV: CLIENT_CATEGORIES[3],
  };
  return aliases[category] || category;
}
