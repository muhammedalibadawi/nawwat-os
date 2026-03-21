/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                midnight: "var(--midnight)",
                "midnight-2": "var(--midnight-2)",
                "midnight-3": "var(--midnight-3)",
                "midnight-4": "var(--midnight-4)",
                cyan: {
                    DEFAULT: "var(--cyan)",
                    soft: "var(--cyan-soft)",
                    dim: "var(--cyan-dim)",
                    glow: "var(--cyan-glow)",
                },
                success: {
                    DEFAULT: "var(--success)",
                    dim: "var(--success-dim)",
                },
                danger: {
                    DEFAULT: "var(--danger)",
                    dim: "var(--danger-dim)",
                },
                warning: {
                    DEFAULT: "var(--warning)",
                    dim: "var(--warning-dim)",
                },
                purple: {
                    DEFAULT: "var(--purple)",
                },
                indigo: {
                    DEFAULT: "var(--indigo)",
                },
                orange: {
                    DEFAULT: "var(--orange)",
                },
                surface: {
                    bg: "var(--bg)",
                    "bg-2": "var(--bg-2)",
                    card: "var(--card)",
                    "card-2": "var(--card-2)",
                },
                content: {
                    DEFAULT: "var(--text)",
                    2: "var(--text-2)",
                    3: "var(--text-3)",
                    4: "var(--text-4)",
                },
                border: {
                    DEFAULT: "var(--border)",
                    2: "var(--border-2)",
                }
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'sans-serif'],
                nunito: ['Nunito', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
                arabic: ['Cairo', 'sans-serif'],
            },
            boxShadow: {
                xs: "0 1px 2px rgba(10,25,47,.06)",
                sm: "0 1px 4px rgba(10,25,47,.08), 0 2px 8px rgba(10,25,47,.04)",
                md: "0 4px 16px rgba(10,25,47,.10), 0 1px 4px rgba(10,25,47,.06)",
                lg: "0 8px 32px rgba(10,25,47,.14), 0 2px 8px rgba(10,25,47,.08)",
                cyan: "0 4px 20px rgba(0,229,255,.20)",
            },
            borderRadius: {
                sm: "8px",
                DEFAULT: "13px",
                lg: "18px",
                xl: "24px",
            }
        },
    },
    plugins: [],
}
