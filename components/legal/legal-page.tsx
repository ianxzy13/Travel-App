import Link from "next/link";
import Markdown from "react-markdown";
import { Logo } from "@/components/logo";

export function LegalPage({ content }: { content: string }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <article className="prose dark:prose-invert prose-headings:font-serif max-w-none">
          <Markdown>{content}</Markdown>
        </article>
      </main>
      <footer className="caps text-muted-foreground border-t py-10 text-center text-sm">
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
      </footer>
    </div>
  );
}
