/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {},
    backdropFilter: {
      'none': 'none',
      'blur': 'blur(20px)',
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
    require("@tailwindcss/aspect-ratio"),
    require("@tailwindcss/line-clamp"),
    require('tailwindcss-filters'),
    require("daisyui"),
    require("prettier-plugin-tailwindcss")
  ],
};
