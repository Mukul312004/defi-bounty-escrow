/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                canvas: "rgb(var(--canvas) / <alpha-value>)",
                "canvas-elevated": "rgb(var(--canvas-elevated) / <alpha-value>)",
                "hairline-soft": "rgb(var(--hairline-soft) / <alpha-value>)",
                hairline: "rgb(var(--hairline) / <alpha-value>)",
                ink: "rgb(var(--ink) / <alpha-value>)",
                body: "rgb(var(--body) / <alpha-value>)",
                mute: "rgb(var(--mute) / <alpha-value>)",
                faint: "rgb(var(--faint) / <alpha-value>)",
                link: {
                    DEFAULT: "#0070f3",
                    deep: "#0761d1",
                    soft: "rgb(var(--link-soft) / <alpha-value>)",
                },
                error: {
                    DEFAULT: "#ee0000",
                    deep: "#c50000",
                },
                warning: {
                    DEFAULT: "#f5a623",
                    soft: "#ffefcf",
                    deep: "#ab570a",
                },
                violet: {
                    DEFAULT: "#7928ca",
                    soft: "#d8ccf1",
                },
                cyan: {
                    DEFAULT: "#50e3c2",
                    soft: "#aaffec",
                },
                pink: "#ff0080",
                magenta: "#eb367f",
            },
            fontFamily: {
                sans: ["Geist", "Inter", "Arial", "sans-serif"],
                mono: ["Geist Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
            },
            borderRadius: {
                sm: "6px",
                md: "12px",
                lg: "16px",
                "pill-category": "64px",
                pill: "100px",
            },
            boxShadow: {
                whisper: "0px 1px 2px rgba(0, 0, 0, 0.04)",
                floating: "0px 2px 4px rgba(0, 0, 0, 0.04), 0px 8px 16px -4px rgba(0, 0, 0, 0.08)",
            },
        },
    },
    plugins: [],
}