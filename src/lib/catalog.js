// Shared mapping helpers between the dashboard and website so the
// camelCase keys the React components use align with the snake_case
// columns in the Supabase `services` table.

export function dbRowToService(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    slug: row.slug || row.name?.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    category: row.category,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    image: row.image_url,
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    ctaLabel: row.cta_label,
    ctaLink: row.cta_link,
    featured: row.featured,
    status: row.status,
    // service pricing
    pricingType: row.pricing_type,
    price: row.price != null ? String(row.price) : "",
    priceMin: row.price_min != null ? String(row.price_min) : "",
    priceMax: row.price_max != null ? String(row.price_max) : "",
    duration: row.duration,
    // product pricing
    regularPrice: row.regular_price != null ? String(row.regular_price) : "",
    salePrice: row.sale_price != null ? String(row.sale_price) : "",
    pricingUnit: row.pricing_unit,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    availability: row.availability,
    startDate: row.start_date,
    endDate: row.end_date,
    sortOrder: row.sort_order,
  };
}

export function serviceToDbRow(svc) {
  const row = {
    type: svc.type,
    name: svc.name,
    slug: svc.slug || svc.name?.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    category: svc.category,
    short_description: svc.shortDescription,
    full_description: svc.fullDescription,
    image_url: svc.image,
    gallery: Array.isArray(svc.gallery) ? svc.gallery : [],
    cta_label: svc.ctaLabel,
    cta_link: svc.ctaLink,
    featured: !!svc.featured,
    status: svc.status,
  };

  if (svc.type === "service") {
    row.pricing_type = svc.pricingType || null;
    row.price = svc.price ? Number(svc.price) : null;
    row.price_min = svc.priceMin ? Number(svc.priceMin) : null;
    row.price_max = svc.priceMax ? Number(svc.priceMax) : null;
    row.duration = svc.duration || null;
    row.regular_price = null;
    row.sale_price = null;
    row.pricing_unit = null;
    row.inclusions = null;
    row.exclusions = null;
    row.availability = null;
    row.start_date = null;
    row.end_date = null;
  } else {
    row.pricing_type = null;
    row.price = null;
    row.price_min = null;
    row.price_max = null;
    row.duration = null;
    row.regular_price = svc.regularPrice ? Number(svc.regularPrice) : null;
    row.sale_price = svc.salePrice ? Number(svc.salePrice) : null;
    row.pricing_unit = svc.pricingUnit || null;
    row.inclusions = svc.inclusions || null;
    row.exclusions = svc.exclusions || null;
    row.availability = svc.availability || null;
    row.start_date = svc.startDate || null;
    row.end_date = svc.endDate || null;
  }

  return row;
}

export function getPriceLabel(item, currency = "\u20B1") {
  if (item.type === "service") {
    switch (item.pricingType) {
      case "fixed":
        return `${currency}${item.price || "0"}`;
      case "starting":
        return `Starting at ${currency}${item.price || "0"}`;
      case "range":
        return `${currency}${item.priceMin || "0"} \u2013 ${currency}${item.priceMax || "0"}`;
      case "quote":
        return "Custom Quote";
      case "free":
        return "Free";
      default:
        return item.price ? `${currency}${item.price}` : "";
    }
  }
  const unit = item.pricingUnit ? ` / ${item.pricingUnit}` : "";
  if (item.salePrice) return `${currency}${item.salePrice}${unit}`;
  return item.regularPrice ? `${currency}${item.regularPrice}${unit}` : "";
}
