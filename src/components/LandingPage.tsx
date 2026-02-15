import './LandingPage.css';
import {
  LANDING_COMPARISON_ROWS,
  LANDING_CREDIBILITY_BULLETS,
  LANDING_FAQ_ITEMS,
  LANDING_FEATURE_BULLETS,
} from '../content/landingContent';

type LandingCtaPlacement = 'launchpad' | 'comparison';

interface LandingPageProps {
  onStartPlanning: (placement: LandingCtaPlacement) => void;
  mode?: 'full' | 'overlay';
  onDismiss?: () => void;
}

const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const OVERLAY_PREVIEW_BULLETS = LANDING_FEATURE_BULLETS.slice(0, 3);

export default function LandingPage({ onStartPlanning, mode = 'full', onDismiss }: LandingPageProps) {
  if (mode === 'overlay') {
    return (
      <div className="landing-overlay-root" role="dialog" aria-modal="true" aria-label="Planner introduction">
        <button
          className="landing-overlay-backdrop"
          type="button"
          aria-label="Dismiss intro panel"
          onClick={onDismiss}
        />
        <section className="landing-overlay-panel">
          <p className="landing-overlay-kicker">Bedroom Layout Planner</p>
          <h1 className="landing-overlay-title">Design a layout that actually fits.</h1>
          <p className="landing-overlay-subtitle">
            Plan with exact dimensions, place furniture confidently, and export a printable PDF.
          </p>
          <ul className="landing-overlay-list" aria-label="Planner highlights">
            {OVERLAY_PREVIEW_BULLETS.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <div className="landing-overlay-actions">
            <button className="ui-btn ui-btn-primary" onClick={() => onStartPlanning('launchpad')}>
              Start Planning
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="landing-shell">
      <main>
        <section className="landing-launchpad" aria-label="Start planning">
          <div className="landing-launchpad-inner">
            <p className="landing-launchpad-kicker">Bedroom Layout Planner</p>
            <h1 className="landing-launchpad-title">Design a layout that actually fits.</h1>
            <p className="landing-launchpad-subtitle">
              Use exact room dimensions, place furniture with confidence, and export a printable PDF.
            </p>
            <div className="landing-launchpad-actions">
              <button className="ui-btn ui-btn-primary landing-launchpad-cta" onClick={() => onStartPlanning('launchpad')}>
                Open The Planner
              </button>
              <a className="landing-launchpad-secondary" href="#details">
                See planner details
              </a>
            </div>
          </div>
        </section>

        <section className="landing-section landing-details-intro" id="details">
          <div className="landing-container">
            <h2 className="landing-section-title">What You Can Do In The Planner</h2>
            <p className="landing-section-subtitle">
              The core workflow is intentionally simple: set the room dimensions, place items, and validate practical fit.
            </p>
            <ul className="landing-proof-list" aria-label="Core planner details">
              {LANDING_CREDIBILITY_BULLETS.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-container">
            <h2 className="landing-section-title">Planner Capabilities</h2>
            <p className="landing-section-subtitle">
              Built for practical room-fit decisions with exact measurements.
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
            <h2 className="landing-section-title">How This Compares</h2>
            <p className="landing-section-subtitle">
              A factual matrix of capabilities people typically need before moving or buying furniture.
            </p>
            <details className="landing-table-details">
              <summary className="landing-table-summary">View capability matrix</summary>
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
            </details>
            <div className="landing-comparison-cta">
              <button className="ui-btn ui-btn-primary" onClick={() => onStartPlanning('comparison')}>
                Open The Planner
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
