import { Link } from 'react-router-dom';
import { MarriageLoginPanel } from '@/components/MarriageLoginPanel';

export function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-orb landing-orb-one" aria-hidden="true" />
      <div className="landing-orb landing-orb-two" aria-hidden="true" />
      <div className="landing-grid">
        <section className="landing-login-column" aria-label="Guest login">
          <div className="landing-brand">Photobooth Management System</div>
          <div className="landing-login-card">
            <MarriageLoginPanel variant="landing" />
          </div>
        </section>

        <section className="landing-story-column">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Celebrate first. Organize later.</p>
            <h1>One place for the couple, the guests, and every beautiful mess in between.</h1>
            <p className="landing-lead">
              Guests can jump straight into their gallery with a one-time code, while your team keeps uploads,
              slideshows, and event access under control behind the scenes.
            </p>
            <div className="landing-feature-row">
              <span>Private gallery access</span>
              <span>Instant login codes</span>
              <span>Admin-managed events</span>
            </div>
          </div>

          <div className="landing-showcase" aria-hidden="true">
            <article className="landing-photo-card landing-photo-card-main">
              <span className="landing-photo-label">Live event flow</span>
              <strong>Invite. Capture. Relive.</strong>
              <p>Secure guest access, private couple uploads, and curated slideshows without juggling separate tools.</p>
            </article>
            <article className="landing-photo-card landing-photo-card-accent">
              <span className="landing-stat">45</span>
              <p>guest uploads collected during one reception night</p>
            </article>
            <article className="landing-photo-card landing-photo-card-note">
              <span className="landing-photo-label">Operator note</span>
              <p>The admin login is intentionally kept small and out of the way below, so guests land exactly where they need to.</p>
            </article>
          </div>
        </section>
      </div>

      <div className="landing-admin-entry">
        <Link to="/admin/login">Admin login</Link>
        <Link to="/booth">Booth setup guide</Link>
      </div>
    </main>
  );
}
