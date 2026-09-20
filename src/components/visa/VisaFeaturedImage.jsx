import React from "react";
import PackageFeaturedImage from "../travel/PackageFeaturedImage.jsx";

export default function VisaFeaturedImage({ country }) {
  const gallery = [...new Set([country.featuredImage, ...(country.gallery || [])].filter(Boolean))];
  if (!gallery.length) return null;
  return <PackageFeaturedImage key={country.slug} pkg={{ slug: country.slug, title: country.country, gallery }} showThumbnails />;
}
