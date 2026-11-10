import { TryJugaad } from "@/components/try-jugaad";
import { ApprovedWordmark } from "@/components/approved-shell";

export default function Home() {
  return (
<section id="marketing" className="marketing">
  <header className="marketing-header shell-width">
    <ApprovedWordmark />
    <div className="marketing-header-right"><a className="header-meta" href="#how-it-works">How it works</a><TryJugaad className="btn btn-dark">Try Jugaad <span aria-hidden="true">↗</span></TryJugaad></div>
  </header>
  <main id="main">
    <section className="hero shell-width">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line"></span> INTRODUCING JUGAAD ONE</div>
        <h1>You say it.<br /><span className="italic-emphasis">Jugaad</span> makes<br />it happen<span className="orange-period">.</span></h1>
        <p className="hero-sub">One conversation to discover, compare, and complete.</p>
        <div className="hero-actions"><TryJugaad className="btn btn-orange btn-lg">Try Jugaad <span>↗</span></TryJugaad><span className="fine-print">No sign-up. Just a conversation.</span></div>
        <div className="hero-footnote"><span className="mini-icon">✳</span> VOICE-FIRST <span className="tiny-divider"></span> MULTILINGUAL <span className="tiny-divider"></span> TRANSACTION-READY</div>
      </div>
      <div className="hero-art" aria-label="Voice to transaction walkthrough">
        <div className="hero-art-top"><span>JUGAAD ONE / HOW IT WORKS</span><span>VOICE <span className="light-dot" aria-hidden="true">●</span></span></div>
        <div className="hero-art-inner">
          <div className="hero-floating-tag tag-top">ONE CONVERSATION <span>↗</span></div>
          <div className="hero-orb"><div className="orb-gloss"></div><div className="orb-core"></div><div className="orb-ring orb-ring-1"></div><div className="orb-ring orb-ring-2"></div></div>
          <div className="hero-floating-tag tag-bottom"><span className="tiny-orange-circle"></span> SEARCH · COMPARE · APPROVE</div>
        </div>
        <div className="hero-art-bottom hero-flow"><span>01 Speak</span><span>02 Compare offers</span><span>03 Approve the quote</span></div>
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
    <section className="providers-section shell-width"><div><span className="section-kicker">02 / CURRENTLY CONNECTED</span><h2>Built for action.<br />Starting with food.</h2></div><div className="providers-right"><div className="provider-badges"><span className="provider-badge wiggy"><span>◒</span> Wiggy</span><span className="provider-badge tomato"><span>◉</span> Tomato</span></div><p>Wiggy and Tomato are fictional providers. Orders and payments are simulated.</p><TryJugaad className="text-cta">Start a conversation <span>↗</span></TryJugaad></div></section>
    <section className="shell-width providers-section"><h2>What can Jugaad get done for you?</h2><TryJugaad className="btn btn-orange">Try Jugaad <span aria-hidden="true">↗</span></TryJugaad></section>
  </main>
  <footer className="marketing-footer shell-width"><span>Jugaad One © 2026</span><span>Say it. Find it. Pay for it.</span><span>Simulated transactions</span></footer>
</section>
  );
}
