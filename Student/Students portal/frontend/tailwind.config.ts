import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./frontend/app/**/*.{ts,tsx}", "./frontend/components/**/*.{ts,tsx}", "./frontend/lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "500",
        bold: "600"
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        soft: "0 18px 55px -35px rgba(15, 23, 42, 0.55)"
      }
    }
  },
  plugins: []
};

export default config;
