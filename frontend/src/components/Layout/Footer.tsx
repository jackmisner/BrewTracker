/**
 * Footer component for the BrewTracker application.
 *
 * Renders a multi-column footer with project links, help resources, and legal information.
 * Includes external links to GitHub, brewing resources, and license information, as well as
 * internal navigation links for reporting bugs, requesting features, and accessing help pages.
 * Displays the current application version and year.
 *
 * @component
 * @returns {JSX.Element} The rendered footer element.
 */
import React from "react";
import { Link } from "react-router";
import packageJson from "../../../package.json";
import "../../styles/Footer.css";

const Footer: React.FC = () => {
  const appVersion: string = packageJson.version;

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Column 1: Project & Development */}
          <div className="footer-column">
            <h3 className="footer-column-title">BrewTracker</h3>
            <ul className="footer-links">
              <li>
                <a
                  href="https://github.com/jackmisner/BrewTracker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link external-link"
                >
                  GitHub Repository
                  <span className="external-icon">↗</span>
                </a>
              </li>
              <li>
                <Link to="/report-bug" className="footer-link">
                  Report Bug/Issue
                </Link>
              </li>
              <li>
                <Link to="/feature-request" className="footer-link">
                  Feature Requests
                </Link>
              </li>
              <li>
                <span className="footer-version">Version {appVersion}</span>
              </li>
            </ul>
          </div>

          {/* Column 2: Help & Resources */}
          <div className="footer-column">
            <h3 className="footer-column-title">Help & Resources</h3>
            <ul className="footer-links">
              <li>
                <Link to="/help" className="footer-link">
                  User Guide
                </Link>
              </li>
              <li>
                <Link to="/faq" className="footer-link">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://www.bjcp.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link external-link"
                >
                  BJCP Style Guidelines
                  <span className="external-icon">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.brewersfriend.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link external-link"
                >
                  Brewing Resources
                  <span className="external-icon">↗</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: About & Legal */}
          <div className="footer-column">
            <h3 className="footer-column-title">About & Legal</h3>
            <ul className="footer-links">
              <li>
                <Link to="/about" className="footer-link">
                  About Me
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="footer-link">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="footer-link">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="https://www.gnu.org/licenses/gpl-3.0.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link external-link"
                >
                  GPL v3 License
                  <span className="external-icon">↗</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} BrewTracker. Built with ❤️ for the brewing
            community.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
