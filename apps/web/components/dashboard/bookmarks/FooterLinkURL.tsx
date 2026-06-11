import Link from "next/link";

export default function FooterLinkURL({ url }: { url: string | null }) {
  if (!url) {
    return null;
  }
  const parsedUrl = new URL(url);
  const host = parsedUrl.host.replace(/^www\./, "");
  return (
    <Link
      className="ease-(--ease-out) line-clamp-1 max-w-full font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      {host}
    </Link>
  );
}
