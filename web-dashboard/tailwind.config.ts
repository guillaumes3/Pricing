import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0E1117",
        mist: "#F4F7FB",
        accent: {
          50: "#F0F8FF",
          100: "#D9ECFF",
          500: "#1A8DFF",
          700: "#0E5FB0"
        },
        success: {
          100: "#D7F7E3",
          700: "#137A43"
        },
        danger: {
          100: "#FFD8D8",
          700: "#9F1D1D"
        }
      },
      boxShadow: {
        floating: "0 15px 40px rgba(14, 17, 23, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
