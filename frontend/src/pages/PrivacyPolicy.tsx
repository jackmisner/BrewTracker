import React from "react";

const PrivacyPolicy: React.FC = () => {
  const lastUpdated = "January 2025";

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="page-subtitle">
          How BrewTracker handles your brewing data and personal information.
        </p>
        <p className="text-sm text-gray-600">Last updated: {lastUpdated}</p>
      </div>

      <div className="content-container">
        {/* Introduction */}
        <div className="card">
          <div className="card-title">Our Commitment to Your Privacy</div>
          <div className="content-section">
            <p>
              BrewTracker is a free, open-source homebrewing management
              application created as a hobby project to serve the brewing
              community. We are committed to protecting your privacy and being
              transparent about how we handle your brewing data.
            </p>
            <p>
              This Privacy Policy explains what information we collect, how we
              use it, and your rights regarding your personal data. As a GPL v3
              licensed project, our commitment extends to keeping both our
              software and practices open and community-focused.
            </p>
          </div>
        </div>

        {/* Information We Collect */}
        <div className="card">
          <div className="card-title">Information We Collect</div>
          <div className="content-section">
            <h3>Account Information</h3>
            <ul>
              <li>
                <strong>Username</strong> - For account identification and
                recipe attribution
              </li>
              <li>
                <strong>Email address</strong> - For account recovery and
                important notifications
              </li>
              <li>
                <strong>Password</strong> - Securely hashed using
                industry-standard encryption
              </li>
              <li>
                <strong>User preferences</strong> - Unit settings
                (metric/imperial), display preferences
              </li>
            </ul>

            <h3>Brewing Data</h3>
            <ul>
              <li>
                <strong>Recipes</strong> - Ingredients, measurements, brewing
                notes, style information
              </li>
              <li>
                <strong>Brew sessions</strong> - Gravity readings, temperatures,
                fermentation logs, tasting notes
              </li>
              <li>
                <strong>Recipe calculations</strong> - OG, FG, ABV, IBU, SRM
                values and brewing metrics
              </li>
              <li>
                <strong>Usage patterns</strong> - Features used, recipe creation
                dates, session activity
              </li>
            </ul>

            <h3>Technical Information</h3>
            <ul>
              <li>
                <strong>Browser information</strong> - For bug reports and
                technical support
              </li>
              <li>
                <strong>Device data</strong> - Screen size, operating system
                (for responsive design)
              </li>
              <li>
                <strong>IP address</strong> - For security and basic geographic
                analytics
              </li>
              <li>
                <strong>Session data</strong> - Authentication tokens, temporary
                application state
              </li>
            </ul>
          </div>
        </div>

        {/* How We Use Information */}
        <div className="card">
          <div className="card-title">How We Use Your Information</div>
          <div className="content-section">
            <h3>Core Application Services</h3>
            <ul>
              <li>Provide brewing calculations and recipe management</li>
              <li>Enable brew session tracking and fermentation monitoring</li>
              <li>Generate AI-powered recipe suggestions and style analysis</li>
              <li>Support BeerXML import/export functionality</li>
              <li>Maintain user preferences and settings</li>
            </ul>

            <h3>Community Features</h3>
            <ul>
              <li>Enable public recipe sharing with proper attribution</li>
              <li>Support community recipe discovery and cloning</li>
              <li>Facilitate brewing knowledge sharing and collaboration</li>
              <li>Provide recipe version control and improvement tracking</li>
            </ul>

            <h3>Application Improvement</h3>
            <ul>
              <li>Analyze usage patterns to improve features</li>
              <li>Identify and fix bugs or performance issues</li>
              <li>Understand which brewing tools are most valuable</li>
              <li>Guide development priorities based on community needs</li>
            </ul>

            <h3>Communication</h3>
            <ul>
              <li>Respond to support requests and bug reports</li>
              <li>Send important security or service updates</li>
              <li>Notify about new features or brewing-related improvements</li>
            </ul>
          </div>
        </div>

        {/* Information Sharing */}
        <div className="card">
          <div className="card-title">Information Sharing & Disclosure</div>
          <div className="content-section">
            <h3>What We Share</h3>
            <ul>
              <li>
                <strong>Public Recipes</strong> - When you choose to make
                recipes public, they become visible to the community with your
                username attribution
              </li>
              <li>
                <strong>Anonymous Statistics</strong> - Aggregated,
                non-identifiable usage data to understand application
                performance
              </li>
              <li>
                <strong>Open Source Contributions</strong> - Bug reports and
                feature requests may include technical details (but not personal
                brewing data)
              </li>
            </ul>

            <h3>What We Never Share</h3>
            <ul>
              <li>
                <strong>Personal Information</strong> - Email addresses,
                passwords, or account details
              </li>
              <li>
                <strong>Private Recipes</strong> - Your private brewing data
                remains completely private
              </li>
              <li>
                <strong>Commercial Use</strong> - We never sell your data to
                third parties
              </li>
              <li>
                <strong>Marketing Data</strong> - No sharing with advertising
                networks or marketing companies
              </li>
            </ul>

            <h3>Legal Requirements</h3>
            <p>
              We may disclose information if required by law, court order, or to
              protect the rights and safety of BrewTracker users. As a hobby
              project, we will always be transparent about any such requests.
            </p>
          </div>
        </div>

        {/* Data Security */}
        <div className="card">
          <div className="card-title">Data Security & Protection</div>
          <div className="content-section">
            <h3>Security Measures</h3>
            <ul>
              <li>
                <strong>Password Security</strong> - All passwords are hashed
                using industry-standard bcrypt encryption
              </li>
              <li>
                <strong>Authentication</strong> - JWT token-based authentication
                with secure session management
              </li>
              <li>
                <strong>Database Security</strong> - MongoDB with access
                controls and secure connection protocols
              </li>
              <li>
                <strong>Code Transparency</strong> - Open source codebase allows
                community security review
              </li>
            </ul>

            <h3>Data Backup & Recovery</h3>
            <p>
              We maintain regular backups of brewing data to prevent loss.
              However, as a hobby project, we recommend users also export their
              important recipes using the BeerXML export feature for personal
              backup.
            </p>

            <h3>Breach Notification</h3>
            <p>
              In the unlikely event of a security breach affecting personal
              data, we will notify affected users via email and provide clear
              information about the incident and any recommended actions.
            </p>
          </div>
        </div>

        {/* Your Rights */}
        <div className="card">
          <div className="card-title">Your Rights & Choices</div>
          <div className="content-section">
            <h3>Data Access & Control</h3>
            <ul>
              <li>
                <strong>Access Your Data</strong> - View all your recipes,
                sessions, and account information
              </li>
              <li>
                <strong>Export Data</strong> - Download your recipes in BeerXML
                format anytime
              </li>
              <li>
                <strong>Modify Information</strong> - Edit recipes, sessions,
                and account details
              </li>
              <li>
                <strong>Privacy Settings</strong> - Control which recipes are
                public or private
              </li>
            </ul>

            <h3>Account Management</h3>
            <ul>
              <li>
                <strong>Account Deletion</strong> - Delete your account and all
                associated data
              </li>
              <li>
                <strong>Data Portability</strong> - Export your brewing data to
                other applications
              </li>
              <li>
                <strong>Recipe Attribution</strong> - Manage how your public
                recipes are attributed
              </li>
              <li>
                <strong>Communication Preferences</strong> - Control
                notification settings
              </li>
            </ul>

            <h3>Exercising Your Rights</h3>
            <p>
              To exercise any of these rights, contact us through the methods
              listed in our <a href="/about">About</a> page or submit a request
              via our
              <a href="/report-bug"> bug report system</a>. We will respond to
              all requests within a reasonable timeframe.
            </p>
          </div>
        </div>

        {/* Cookies & Tracking */}
        <div className="card">
          <div className="card-title">Cookies & Local Storage</div>
          <div className="content-section">
            <h3>Essential Cookies</h3>
            <ul>
              <li>
                <strong>Authentication Tokens</strong> - Keep you logged in
                securely
              </li>
              <li>
                <strong>User Preferences</strong> - Remember your unit settings
                and preferences
              </li>
              <li>
                <strong>Session Data</strong> - Maintain application state
                during your visit
              </li>
            </ul>

            <h3>No Tracking Cookies</h3>
            <p>
              BrewTracker does not use advertising cookies, third-party
              tracking, or analytics cookies. We respect your privacy and focus
              solely on providing brewing management features.
            </p>

            <h3>Local Storage</h3>
            <p>
              We use browser local storage to improve your experience by caching
              frequently used data and maintaining application state. This data
              stays on your device and is not transmitted to our servers.
            </p>
          </div>
        </div>

        {/* Data Retention */}
        <div className="card">
          <div className="card-title">Data Retention</div>
          <div className="content-section">
            <h3>Active Accounts</h3>
            <p>
              We retain your brewing data as long as your account remains active
              to provide continuous service and maintain your brewing history.
            </p>

            <h3>Account Deletion</h3>
            <p>
              When you delete your account, we remove all personal information
              and private recipes immediately. Public recipes may remain in the
              community collection with attribution removed, as they contribute
              to the brewing knowledge base.
            </p>

            <h3>Inactive Accounts</h3>
            <p>
              We may reach out to accounts inactive for extended periods (1+
              years) to confirm continued interest. After reasonable attempts to
              contact inactive users, accounts may be archived with data
              preserved.
            </p>
          </div>
        </div>

        {/* Children's Privacy */}
        <div className="card">
          <div className="card-title">Children's Privacy</div>
          <div className="content-section">
            <p>
              BrewTracker is designed for adults of legal drinking age. In the
              UK, we do not knowingly collect personal information from
              individuals under 18 years of age, as this is the legal age for
              purchasing and consuming alcohol.
            </p>
            <p>
              If we become aware that we have collected personal information
              from someone under 18 years of age, we will take steps to delete
              that information promptly in accordance with UK data protection
              requirements.
            </p>
          </div>
        </div>

        {/* GDPR & UK Data Protection */}
        <div className="card">
          <div className="card-title">GDPR & UK Data Protection</div>
          <div className="content-section">
            <h3>UK Data Protection Act 2018 & UK GDPR Compliance</h3>
            <p>
              BrewTracker is operated from the United Kingdom and complies with
              the UK Data Protection Act 2018 and UK GDPR. Your personal data is
              processed and stored in accordance with UK data protection laws.
            </p>

            <h3>Legal Basis for Processing</h3>
            <p>
              We process your personal data under the following legal bases:
            </p>
            <ul>
              <li>
                <strong>Consent</strong> - For account creation and public
                recipe sharing
              </li>
              <li>
                <strong>Legitimate Interest</strong> - For service improvement
                and security
              </li>
              <li>
                <strong>Contract Performance</strong> - To provide brewing
                management services
              </li>
            </ul>

            <h3>Your GDPR Rights</h3>
            <p>Under UK GDPR, you have the right to:</p>
            <ul>
              <li>
                <strong>Access</strong> - Request a copy of your personal data
              </li>
              <li>
                <strong>Rectification</strong> - Correct inaccurate personal
                data
              </li>
              <li>
                <strong>Erasure</strong> - Request deletion of your personal
                data
              </li>
              <li>
                <strong>Portability</strong> - Export your data in a
                machine-readable format
              </li>
              <li>
                <strong>Restriction</strong> - Limit how we process your data
              </li>
              <li>
                <strong>Objection</strong> - Object to processing based on
                legitimate interest
              </li>
              <li>
                <strong>Withdraw Consent</strong> - Revoke consent for specific
                processing
              </li>
            </ul>

            <h3>International Data Transfers</h3>
            <p>
              Your data is primarily processed within the UK. Any international
              transfers (such as cloud hosting services) are conducted with
              appropriate safeguards and in compliance with UK GDPR transfer
              requirements.
            </p>

            <h3>Data Protection Officer</h3>
            <p>
              For a hobby project of this scale, we do not have a formal Data
              Protection Officer. However, data protection inquiries can be
              directed through our standard contact methods listed below.
            </p>

            <h3>Supervisory Authority</h3>
            <p>
              You have the right to lodge a complaint with the UK Information
              Commissioner's Office (ICO) if you believe your data protection
              rights have been violated. Visit{" "}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
              >
                ico.org.uk
              </a>{" "}
              for more information.
            </p>
          </div>
        </div>

        {/* Changes to Privacy Policy */}
        <div className="card">
          <div className="card-title">Changes to This Privacy Policy</div>
          <div className="content-section">
            <p>
              We may update this Privacy Policy from time to time to reflect
              changes in our practices or for legal reasons. When we make
              significant changes, we will:
            </p>
            <ul>
              <li>Update the "Last Updated" date at the top of this policy</li>
              <li>Notify users via email or in-application notification</li>
              <li>Provide a clear summary of changes made</li>
              <li>Allow time for review before changes take effect</li>
            </ul>
            <p>
              Continued use of BrewTracker after changes become effective
              constitutes acceptance of the updated Privacy Policy.
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <div className="card-title">Contact Us</div>
          <div className="content-section">
            <p>
              If you have questions, concerns, or requests regarding this
              Privacy Policy or your personal data, please contact us:
            </p>
            <ul>
              <li>
                Visit our <a href="/about">About</a> page for contact
                information
              </li>
              <li>
                Submit a privacy-related <a href="/report-bug">bug report</a>
              </li>
              <li>
                Check our <a href="/faq">FAQ</a> for common privacy questions
              </li>
              <li>
                Email: privacy@brewtracker.app (for privacy-specific inquiries)
              </li>
            </ul>
            <p>
              We are committed to addressing privacy concerns promptly and
              transparently as part of our dedication to the brewing community.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
