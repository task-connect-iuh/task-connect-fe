/** @type {import('tailwindcss').Config} */
// Tailwind chi dung cho layout (flex/grid/gap/p/m/w/h). Mau, radius, bong,
// co chu lay tu component DS hoac var(--...) truc tiep. Xem 21-react-frontend.md.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: {
        1: 'var(--sp-1)', 2: 'var(--sp-2)', 3: 'var(--sp-3)', 4: 'var(--sp-4)',
        5: 'var(--sp-5)', 6: 'var(--sp-6)', 8: 'var(--sp-8)', 10: 'var(--sp-10)',
        12: 'var(--sp-12)', 16: 'var(--sp-16)', 20: 'var(--sp-20)',
      },
      colors: {
        brand: 'var(--brand)', money: 'var(--money)', paper: 'var(--bg-app)',
        ink: 'var(--text-body)',
      },
      borderRadius: {
        sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)',
        xl: 'var(--r-xl)', pill: 'var(--r-pill)',
      },
      maxWidth: {
        container: 'var(--container-max)', content: 'var(--content-max)',
      },
    },
  },
  plugins: [],
}
