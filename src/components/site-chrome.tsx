import { ArrowRight } from "lucide-react";
import Link from "next/link";

function Wordmark() {
  return <Link className="submission-wordmark" href="/">Jugaad One</Link>;
}
import { ActionLink } from "./ui";

export function SiteHeader() {
  return (
    <header className="recovery-header">
      <div className="container">
        <Wordmark />
        <ActionLink href="/workspace">Try Jugaad <ArrowRight size={16} aria-hidden="true" /></ActionLink>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="recovery-footer">
      <div className="container">
        <Wordmark />
        <p>Jugaad One is a simulated marketplace. No money is charged.</p>
      </div>
    </footer>
  );
}
