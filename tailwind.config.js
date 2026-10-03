/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // "visible" appears in CMS content keys (section visibility flags), which
  // would otherwise make Tailwind emit a global .visible utility the site
  // never used. Keep the generated CSS identical to before the CMS switch.
  blocklist: ["visible"],
  theme: {
    extend: {},
  },
  plugins: [],
}
