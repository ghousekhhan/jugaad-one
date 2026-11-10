import Link from "next/link";
import { ApprovedWordmark } from "@/components/approved-shell";

export default function Home() {
  return (
<section id="marketing" className="marketing">
  <header className="marketing-header shell-width">
    <ApprovedWordmark />
    <div className="marketing-header-right"><span className="header-meta">A more natural way to get things done.</span><Link className="btn btn-dark" href="/workspace">Try Jugaad <span aria-hidden="true">↗</span></Link></div>
  </header>
  <main id="main">
    <section className="hero shell-width">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line"></span> INTRODUCING JUGAAD ONE</div>
        <h1>You say it.<br /><span className="italic-emphasis">Jugaad</span> makes<br />it happen<span className="orange-period">.</span></h1>
        <p className="hero-sub">A multilingual AI transaction layer that understands what you need, compares available options, and helps you complete the transaction through one conversation.</p>
        <div className="hero-actions"><Link className="btn btn-orange btn-lg" href="/workspace">Try Jugaad <span>↗</span></Link><span className="fine-print">No sign-up. Just a conversation.</span></div>
        <div className="hero-footnote"><span className="mini-icon">✳</span> VOICE-FIRST <span className="tiny-divider"></span> MULTILINGUAL <span className="tiny-divider"></span> TRANSACTION-READY</div>
      </div>
      <div className="hero-art" aria-label="Launch film poster">
        <div className="hero-art-top"><span>JUGAAD ONE / LAUNCH FILM</span><span>POSTER <span className="light-dot" aria-hidden="true">●</span></span></div>
        <div className="hero-art-inner">
          <div className="hero-floating-tag tag-top">ONE CONVERSATION <span>↗</span></div>
          <div className="hero-orb"><div className="orb-gloss"></div><div className="orb-core"></div><div className="orb-ring orb-ring-1"></div><div className="orb-ring orb-ring-2"></div></div>
          <div className="hero-floating-tag tag-bottom"><span className="tiny-orange-circle"></span> SEARCH · COMPARE · APPROVE</div>
        </div>
        <div className="hero-art-bottom"><span>LAUNCH FILM POSTER</span></div>
      </div>
    </section>
    <section className="how-section shell-width" id="how-it-works">
      <div className="section-kicker">01 / THE EXPERIENCE</div>
      <div className="how-header"><h2>Less switching.<br /><span>More doing.</span></h2><p>Jugaad connects discovery, comparison and approval in one continuous conversation. You stay in control of the final decision.</p></div>
      <div className="how-steps">
        <div className="how-step"><span className="step-num">01</span><div className="step-glyph">〰</div><h3>Say what you need.</h3><p>Speak naturally, in your language.</p></div>
        <div className="how-step"><span className="step-num">02</span><div className="step-glyph">▤</div><h3>Compare intelligently.</h3><p>See the trade-offs that actually matter.</p></div>
        <div className="how-step"><span className="step-num">03</span><div className="step-glyph">↗</div><h3>Approve and complete.</h3><p>Confirm before any simulated transaction.</p></div>
      </div>
    </section>
    <section className="providers-section shell-width"><div><span className="section-kicker">02 / CURRENTLY CONNECTED</span><h2>Built for action.<br />Starting with food.</h2></div><div className="providers-right"><div className="provider-badges"><span className="provider-badge wiggy"><span>◒</span> Wiggy</span><span className="provider-badge tomato"><span>◉</span> Tomato</span></div><p>Fictional providers in a sandbox environment. No real purchases or payments are made.</p><Link className="text-cta" href="/workspace">Start a conversation <span>↗</span></Link></div></section>
  </main>
  <footer className="marketing-footer shell-width"><span>Jugaad One © 2026</span><span>Say it. Find it. Pay for it.</span><span>Simulated sandbox</span></footer>
</section>
  );
}
