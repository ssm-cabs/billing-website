"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ""}`}>
        <a className={styles.brand} href="#">
          SSM Cabs
        </a>
        <div
          className={`${styles.navLinks} ${
            isMenuOpen ? styles.navLinksOpen : ""
          }`}
        >
          <a href="#features" onClick={() => setIsMenuOpen(false)}>
            Features
          </a>
          <a href="#workflow" onClick={() => setIsMenuOpen(false)}>
            Workflow
          </a>
          <a href="#pricing" onClick={() => setIsMenuOpen(false)}>
            Pricing Model
          </a>
        </div>
        <div className={styles.navActions}>
          <Link className={styles.navCta} href="/dashboard">
            Login
          </Link>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <svg
              className={styles.menuIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Billing + ride entry</p>
            <h1>
              Corporate cab billing, tuned for daily ops and monthly invoices.
            </h1>
            <p className={styles.lead}>
              Track every ride by company, apply slot-based rates, and generate
              monthly invoices without spreadsheet chaos.
            </p>
            <div className={styles.actions}>
              <a className={styles.secondaryCta} href="#features">
                Explore Features
              </a>
            </div>
            <div className={styles.badges}>
              <span>300+ entries/day ready</span>
              <span>Per-company pricing</span>
              <span>Monthly invoice export</span>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Today</p>
                <h2>Ride Entry Desk</h2>
              </div>
              <span className={styles.panelTag}>Live</span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.panelRow}>
                <div>
                  <p className={styles.panelTitle}>Acme Corp</p>
                  <p className={styles.panelMeta}>SUV · 6hr slot</p>
                </div>
                <span className={styles.panelValue}>₹ 2,400</span>
              </div>
              <div className={styles.panelRow}>
                <div>
                  <p className={styles.panelTitle}>Globex</p>
                  <p className={styles.panelMeta}>Sedan · 4hr slot</p>
                </div>
                <span className={styles.panelValue}>₹ 1,200</span>
              </div>
              <div className={styles.panelRow}>
                <div>
                  <p className={styles.panelTitle}>Umbrella</p>
                  <p className={styles.panelMeta}>Tempo Traveller · 12hr</p>
                </div>
                <span className={styles.panelValue}>₹ 5,800</span>
              </div>
            </div>
            <div className={styles.panelFooter}>
              <div>
                <p className={styles.panelMeta}>Entries captured</p>
                <p className={styles.panelStat}>48</p>
              </div>
              <div>
                <p className={styles.panelMeta}>Monthly total</p>
                <p className={styles.panelStat}>₹ 4.2L</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section id="features" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Core features</p>
            <h2>Everything your billing desk needs, in one flow.</h2>
          </div>
          <div className={styles.featureGrid}>
            <article>
              <h3>Daily entry at speed</h3>
              <p>Capture rides in seconds with slot-based pricing and auto-rate lookup.</p>
            </article>
            <article>
              <h3>Per-company pricing</h3>
              <p>Maintain rates by cab type and slot for every corporate client.</p>
            </article>
            <article>
              <h3>Monthly billing</h3>
              <p>Generate invoices by company and export clean summaries for finance.</p>
            </article>
            <article>
              <h3>Audit-ready history</h3>
              <p>Track edits, revisions, and totals with clean entry records.</p>
            </article>
          </div>
        </section>

        <section id="workflow" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Workflow</p>
            <h2>From entry to invoice in three moves.</h2>
          </div>
          <div className={styles.steps}>
            <div>
              <span>01</span>
              <h3>Log rides</h3>
              <p>Choose company, cab type, slot, and route to auto-calc rate.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Review monthly totals</h3>
              <p>Filter by company, month, or vehicle to verify totals.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Publish invoices</h3>
              <p>Export invoices with clean line items and share with clients.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Pricing model</p>
            <h2>Built for slot-based corporate rates.</h2>
          </div>
          <div className={styles.pricingBox}>
            <div>
              <h3>Flexible slots</h3>
              <p>Support 4hr, 6hr, 12hr, or custom slots per client agreement.</p>
            </div>
            <div>
              <h3>Cab types</h3>
              <p>Sedan, SUV, tempo traveller, and any fleet variant you add.</p>
            </div>
            <div>
              <h3>Smart rate lookup</h3>
              <p>Rates are auto-applied from the pricing sheet per company.</p>
            </div>
          </div>
        </section>

      </main>

      <footer className={styles.footer}>
        <p>SSM Cabs · Corporate Ride Billing</p>
        <p>Built for daily entry ops and monthly invoicing.</p>
      </footer>
    </div>
  );
}
