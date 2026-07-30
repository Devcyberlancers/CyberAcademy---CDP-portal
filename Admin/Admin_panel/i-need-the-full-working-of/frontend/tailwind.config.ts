import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        portal: {
          navy: "#111846",
          navyDeep: "#071126",
          blue: "#3658ff",
          bg: "#f5f7fb",
          line: "#e5e7ef"
        }
      },
      boxShadow: {
        soft: "0 18px 45px rgba(24, 32, 79, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
