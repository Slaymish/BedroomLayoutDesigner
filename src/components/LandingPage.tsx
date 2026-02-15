import './LandingPage.css';
import {
  LANDING_COMPARISON_ROWS,
  LANDING_CREDIBILITY_BULLETS,
  LANDING_FAQ_ITEMS,
  LANDING_FEATURE_BULLETS,
} from '../content/landingContent';

type LandingCtaPlacement = 'header' | 'hero' | 'comparison';

interface LandingPageProps {
  onStartPlanning: (placement: LandingCtaPlacement) => void;
}

const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function LandingPage({ onStartPlanning }: LandingPageProps) {
  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <a className="landing-brand" href="/" aria-label="Bedroom Layout Planner home">
            Bedroom Layout Planner
          </a>
          <button className="ui-btn ui-btn-primary" onClick={() => onStartPlanning('header')}>
            Start Planning
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero-inner">
            <p className="landing-kicker">Bedroom Layout Planner</p>
            <h1 className="landing-title">Design A Bedroom Layout That Actually Fits</h1>
            <p className="landing-subtitle">
              Enter exact room dimensions, place furniture and openings, and export a printable layout in minutes.
              No account required.
            </p>
            <div className="landing-cta-row">
              <button className="ui-btn ui-btn-primary" onClick={() => onStartPlanning('hero')}>
                Open The Planner
              </button>
              <a className="ui-btn ui-btn-ghost" href="#comparison">
                Compare Features
              </a>
            </div>
            <ul className="landing-proof-list" aria-label="Core benefits">
              {LANDING_CREDIBILITY_BULLETS.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-container">
            <h2 className="landing-section-title">Built For Practical Room Decisions</h2>
            <p className="landing-section-subtitle">
              This tool is designed for furniture-fit decisions, not inspiration-only browsing.
            </p>
            <ul className="landing-feature-grid" aria-label="Planner capabilities">
              {LANDING_FEATURE_BULLETS.map((feature) => (
                <li key={feature} className="landing-feature-card">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-section" id="comparison">
          <div className="landing-container">
            <h2 className="landing-section-title">Feature Comparison</h2>
            <p className="landing-section-subtitle">
              A factual matrix of practical capabilities people usually need before moving or buying furniture.
            </p>
            <div className="landing-table-wrap" role="region" aria-label="Feature comparison table">
              <table className="landing-table">
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">Bedroom Layout Planner</th>
                    <th scope="col">Template Tools</th>
                    <th scope="col">Inspiration Articles</th>
                  </tr>
                </thead>
                <tbody>
                  {LANDING_COMPARISON_ROWS.map((row) => (
                    <tr key={row.capability}>
                      <th scope="row">{row.capability}</th>
                      <td>{row.bedroomLayoutPlanner}</td>
                      <td>{row.templateTools}</td>
                      <td>{row.inspirationArticles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="landing-comparison-cta">
              <button className="ui-btn ui-btn-primary" onClick={() => onStartPlanning('comparison')}>
                Start Planning My Room
              </button>
            </div>
          </div>
        </section>

        <section className="landing-section" id="faq">
          <div className="landing-container">
            <h2 className="landing-section-title">Frequently Asked Questions</h2>
            <div className="landing-faq-list">
              {LANDING_FAQ_ITEMS.map((item) => (
                <article key={item.question} id={`faq-${toSlug(item.question)}`} className="landing-faq-item">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                  {item.links && item.links.length > 0 && (
                    <p className="landing-faq-links">
                      {item.links.map((link) => (
                        <a
                          key={`${item.question}-${link.href}`}
                          className="landing-faq-link"
                          href={link.href}
                          target={link.href.startsWith('http') ? '_blank' : undefined}
                          rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                        >
                          {link.label}
                        </a>
                      ))}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export type { LandingCtaPlacement };
