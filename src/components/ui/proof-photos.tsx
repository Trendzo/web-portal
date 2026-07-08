/**
 * Driver-captured proof photos (delivery proof, not-home evidence, signature).
 * Thumbnail strip; click opens the full image in a new tab.
 */
export function ProofPhotoStrip({
  photos,
  signatureUrl,
}: {
  photos: string[];
  signatureUrl?: string | null | undefined;
}) {
  const all = [
    ...photos.map((url) => ({ url, label: 'Proof photo' })),
    ...(signatureUrl ? [{ url: signatureUrl, label: 'Signature' }] : []),
  ];
  if (all.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {all.map((p, i) => (
        <button
          key={`${p.url}-${i}`}
          type="button"
          title={`${p.label} — open full size`}
          onClick={() => window.open(p.url, '_blank', 'noopener,noreferrer')}
          className="group relative size-14 overflow-hidden rounded border border-line bg-bg-2 focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <img
            src={p.url}
            alt={p.label}
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        </button>
      ))}
    </div>
  );
}
