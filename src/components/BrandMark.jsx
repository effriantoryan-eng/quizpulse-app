export default function BrandMark({ size = 40 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      <rect width="100" height="100" fill="#201e1d"/>
      <circle cx="48" cy="44" r="24" fill="none" stroke="white" strokeWidth="8"/>
      <line x1="60" y1="58" x2="76" y2="78" stroke="#ca2910" strokeWidth="8" strokeLinecap="square"/>
    </svg>
  );
}
