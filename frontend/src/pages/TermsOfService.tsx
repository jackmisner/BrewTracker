import React from "react";

const TermsOfService: React.FC = () => {
  const lastUpdated = "July 2025";

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Terms of Service</h1>
        <p className="page-subtitle">
          Guidelines for using BrewTracker safely and responsibly.
        </p>
        <p className="text-sm text-gray-600">
          Last updated: {lastUpdated}
        </p>
      </div>
      
      <div className="content-container">
        {/* Introduction */}
        <div className="card">
          <div className="card-title">Welcome to BrewTracker</div>
          <div className="content-section">
            <p>
              BrewTracker is a free, open-source homebrewing management application 
              designed to help the brewing community create, manage, and share beer 
              recipes. By using BrewTracker, you agree to these Terms of Service.
            </p>
            <p>
              This is a hobby project created to serve homebrewers, released under 
              the GPL v3 license to ensure it remains free and open for the community. 
              Please read these terms carefully, especially the safety disclaimers 
              related to homebrewing.
            </p>
          </div>
        </div>

        {/* Brewing Safety Notice - PROMINENT */}
        <div className="card" style={{border: "2px solid #dc2626", backgroundColor: "#fef2f2"}}>
          <div className="card-title" style={{color: "#dc2626"}}>
            ⚠️ IMPORTANT BREWING SAFETY NOTICE
          </div>
          <div className="content-section">
            <p><strong>
              Homebrewing involves alcohol production and potentially dangerous processes. 
              You are solely responsible for:
            </strong></p>
            <ul style={{marginBottom: "1rem"}}>
              <li><strong>Following all local laws</strong> regarding alcohol production and consumption</li>
              <li><strong>Ensuring proper sanitation</strong> and safety procedures during brewing</li>
              <li><strong>Verifying recipe calculations</strong> independently before brewing</li>
              <li><strong>Understanding fermentation risks</strong> including contamination and over-carbonation</li>
              <li><strong>Proper storage and consumption</strong> practices for alcoholic beverages</li>
              <li><strong>Using appropriate equipment</strong> and following manufacturer guidelines</li>
            </ul>
            
            <div style={{backgroundColor: "#fee2e2", padding: "1rem", borderRadius: "0.375rem", border: "1px solid #fca5a5"}}>
              <p><strong>CALCULATION & LEGAL DISCLAIMER:</strong></p>
              <p>
                BrewTracker calculations are estimates based on standard brewing formulas. 
                Actual results may vary significantly due to ingredients, equipment efficiency, 
                process variations, environmental conditions, and other factors. 
                <strong> Always verify critical measurements independently.</strong>
              </p>
              <p>
                <strong>UK Legal Notice:</strong> Ensure compliance with UK homebrewing laws. 
                Generally, beer and cider produced for personal consumption are duty-free, 
                but commercial production requires proper licensing from HMRC. 
                <strong>You are responsible for understanding and following all applicable laws.</strong>
              </p>
              <p style={{marginBottom: 0}}>
                <strong>No warranty is provided for calculation accuracy or legal compliance. 
                Use at your own risk.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Service Description */}
        <div className="card">
          <div className="card-title">Service Description</div>
          <div className="content-section">
            <h3>What BrewTracker Provides</h3>
            <ul>
              <li><strong>Recipe Management</strong> - Create, edit, and organize beer recipes</li>
              <li><strong>Brewing Calculations</strong> - Estimate OG, FG, ABV, IBU, and SRM values</li>
              <li><strong>Brew Session Tracking</strong> - Log fermentation progress and brewing notes</li>
              <li><strong>Community Sharing</strong> - Share recipes publicly with the brewing community</li>
              <li><strong>AI Suggestions</strong> - Get recipe optimization recommendations</li>
              <li><strong>BeerXML Support</strong> - Import and export recipes in standard format</li>
              <li><strong>Style Analysis</strong> - Compare recipes against BJCP style guidelines</li>
            </ul>

            <h3>Service Nature</h3>
            <p>
              BrewTracker is a <strong>hobby project</strong> provided free of charge 
              to the brewing community. It is licensed under GPL v3 and maintained 
              by volunteers. There are no guarantees of uptime, support response 
              times, or feature availability.
            </p>
          </div>
        </div>

        {/* UK Brewing Regulations */}
        <div className="card">
          <div className="card-title">UK Homebrewing Regulations</div>
          <div className="content-section">
            <h3>Legal Framework</h3>
            <p>
              Homebrewing in the UK is generally legal and well-regulated. Key points:
            </p>
            <ul>
              <li><strong>Personal Consumption</strong> - Beer and cider brewed for personal consumption are typically duty-free</li>
              <li><strong>No Licensing Required</strong> - Home production for personal use doesn't require special licensing</li>
              <li><strong>Quantity Limits</strong> - Check current HMRC guidelines for any production limits</li>
              <li><strong>Sale Restrictions</strong> - Selling homebrew generally requires proper licensing and duty payment</li>
            </ul>

            <h3>Resources</h3>
            <p>For official guidance, consult:</p>
            <ul>
              <li><a href="https://www.gov.uk/guidance/alcohol-duty" target="_blank" rel="noopener noreferrer">HMRC Alcohol Duty guidance</a></li>
              <li><a href="https://www.gov.uk/alcohol-licensing" target="_blank" rel="noopener noreferrer">UK Alcohol Licensing information</a></li>
              <li>Your local council for area-specific requirements</li>
            </ul>

            <p>
              <strong>Important:</strong> This information is for general guidance only 
              and should not be considered legal advice. Always consult official sources 
              and legal professionals for specific situations.
            </p>
          </div>
        </div>

        {/* User Responsibilities */}
        <div className="card">
          <div className="card-title">Your Responsibilities</div>
          <div className="content-section">
            <h3>Account Management</h3>
            <ul>
              <li>Provide accurate and current account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Notify us promptly of any unauthorized account access</li>
              <li>Use a valid email address for account recovery</li>
            </ul>

            <h3>Legal Compliance</h3>
            <ul>
              <li><strong>Age Requirement</strong> - You must be at least 18 years old (UK legal drinking age)</li>
              <li><strong>UK Brewing Laws</strong> - Comply with UK laws regarding alcohol production for personal consumption</li>
              <li><strong>HMRC Compliance</strong> - Understand UK homebrewing regulations and duty obligations</li>
              <li><strong>Local Authority Requirements</strong> - Check for any local council requirements in your area</li>
              <li><strong>Duty Limits</strong> - Be aware of UK duty-free allowances for home production (typically beer/cider for personal consumption is duty-free)</li>
            </ul>

            <h3>Responsible Use</h3>
            <ul>
              <li>Use BrewTracker only for legitimate homebrewing purposes</li>
              <li>Respect the intellectual property and recipes of other users</li>
              <li>Provide accurate information in recipes and brewing data</li>
              <li>Report bugs, security issues, or inappropriate content</li>
              <li>Maintain respectful communication with the community</li>
            </ul>
          </div>
        </div>

        {/* Content & Intellectual Property */}
        <div className="card">
          <div className="card-title">Content & Intellectual Property</div>
          <div className="content-section">
            <h3>Your Content Rights</h3>
            <ul>
              <li><strong>Recipe Ownership</strong> - You retain ownership of your original recipes</li>
              <li><strong>Private Recipes</strong> - Your private recipes remain completely private</li>
              <li><strong>Data Export</strong> - You can export your data anytime using BeerXML format</li>
              <li><strong>Account Deletion</strong> - You can delete your account and data at any time</li>
            </ul>

            <h3>Public Recipe Sharing</h3>
            <ul>
              <li><strong>Attribution License</strong> - Public recipes are shared with attribution under Creative Commons</li>
              <li><strong>Community Benefit</strong> - Public recipes contribute to brewing knowledge sharing</li>
              <li><strong>Cloning Rights</strong> - Other users may clone and modify your public recipes</li>
              <li><strong>Attribution Respect</strong> - Always respect original recipe creators when cloning</li>
            </ul>

            <h3>BrewTracker Software</h3>
            <ul>
              <li><strong>GPL v3 License</strong> - The BrewTracker software is licensed under GPL v3</li>
              <li><strong>Open Source</strong> - Source code is freely available on GitHub</li>
              <li><strong>Modification Rights</strong> - You can modify and redistribute under GPL v3 terms</li>
              <li><strong>No Warranty</strong> - Software provided "as is" without warranty</li>
            </ul>

            <h3>Respect for Others' Rights</h3>
            <ul>
              <li>Do not upload copyrighted recipes without permission</li>
              <li>Respect trademark and brand names in recipe naming</li>
              <li>Give proper attribution when sharing or modifying others' recipes</li>
              <li>Report any copyright or intellectual property concerns</li>
            </ul>
          </div>
        </div>

        {/* Prohibited Uses */}
        <div className="card">
          <div className="card-title">Prohibited Uses</div>
          <div className="content-section">
            <h3>Commercial Restrictions</h3>
            <ul>
              <li><strong>No Commercial Resale</strong> - Do not sell access to BrewTracker or user recipes</li>
              <li><strong>Bulk Commercial Use</strong> - Contact us before using recipes for commercial brewing</li>
              <li><strong>Data Mining</strong> - No automated scraping of recipe or user data</li>
              <li><strong>Competitive Services</strong> - Do not use our data to build competing services without GPL compliance</li>
            </ul>

            <h3>Community Violations</h3>
            <ul>
              <li><strong>Harassment</strong> - No harassment, abuse, or inappropriate behavior toward other users</li>
              <li><strong>Spam</strong> - No spam, automated submissions, or excessive promotional content</li>
              <li><strong>Fake Content</strong> - No intentionally false or misleading recipe information</li>
              <li><strong>Impersonation</strong> - Do not impersonate other users or brewing professionals</li>
            </ul>

            <h3>Technical Violations</h3>
            <ul>
              <li><strong>Security Testing</strong> - No unauthorized security testing or penetration attempts</li>
              <li><strong>System Abuse</strong> - No attempts to overwhelm or damage our systems</li>
              <li><strong>Malicious Code</strong> - No uploading or transmitting malicious software</li>
              <li><strong>Access Violations</strong> - No unauthorized access to other users' private data</li>
            </ul>

            <h3>Legal Violations</h3>
            <ul>
              <li>No illegal alcohol production or distribution under UK law</li>
              <li>No violation of UK brewing laws, HMRC regulations, or local authority requirements</li>
              <li>No copyright infringement or intellectual property theft</li>
              <li>No use for any illegal purposes under UK or applicable law</li>
            </ul>
          </div>
        </div>

        {/* Service Availability */}
        <div className="card">
          <div className="card-title">Service Availability & Limitations</div>
          <div className="content-section">
            <h3>Hobby Project Nature</h3>
            <p>
              BrewTracker is maintained as a hobby project by volunteers. We provide 
              the service free of charge but cannot guarantee:
            </p>
            <ul>
              <li><strong>Uptime</strong> - 24/7 availability or specific uptime percentages</li>
              <li><strong>Support</strong> - Immediate response to support requests</li>
              <li><strong>Feature Availability</strong> - Continued availability of any specific feature</li>
              <li><strong>Data Backup</strong> - Although we make reasonable efforts, you should backup important data</li>
            </ul>

            <h3>Service Modifications</h3>
            <p>We reserve the right to:</p>
            <ul>
              <li>Modify, suspend, or discontinue any feature or service</li>
              <li>Update brewing calculations or formulas for accuracy</li>
              <li>Change system requirements or supported browsers</li>
              <li>Implement new features or remove existing ones</li>
            </ul>

            <h3>Account Management</h3>
            <p>We may suspend or terminate accounts that:</p>
            <ul>
              <li>Violate these Terms of Service</li>
              <li>Engage in prohibited activities</li>
              <li>Remain inactive for extended periods (with notice)</li>
              <li>Pose security risks to the community</li>
            </ul>
          </div>
        </div>

        {/* Disclaimers & Limitations */}
        <div className="card">
          <div className="card-title">Disclaimers & Limitation of Liability</div>
          <div className="content-section">
            <h3>Educational Purpose</h3>
            <p>
              BrewTracker is provided for <strong>educational and informational purposes only</strong>. 
              It is not a substitute for professional brewing knowledge, safety training, 
              or compliance with applicable laws and regulations.
            </p>

            <h3>No Warranties</h3>
            <p>
              BrewTracker is provided <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> 
              without warranties of any kind, including but not limited to:
            </p>
            <ul>
              <li>Accuracy of brewing calculations or suggestions</li>
              <li>Reliability or availability of the service</li>
              <li>Suitability for any particular brewing purpose</li>
              <li>Freedom from errors, bugs, or security vulnerabilities</li>
              <li>Compatibility with your brewing equipment or methods</li>
            </ul>

            <h3>Limitation of Liability</h3>
            <p>
              <strong>To the maximum extent permitted by law, BrewTracker and its creators 
              shall not be liable for any damages arising from:</strong>
            </p>
            <ul>
              <li><strong>Brewing Accidents</strong> - Injuries, property damage, or contamination during brewing</li>
              <li><strong>Recipe Results</strong> - Poor beer quality, failed batches, or unexpected outcomes</li>
              <li><strong>Legal Issues</strong> - Violations of local brewing laws or regulations</li>
              <li><strong>Data Loss</strong> - Loss of recipes, brew session data, or account information</li>
              <li><strong>Service Interruption</strong> - Downtime, maintenance, or service discontinuation</li>
              <li><strong>Third-Party Content</strong> - Issues arising from public recipes or user-generated content</li>
            </ul>

            <h3>Maximum Liability</h3>
            <p>
              Since BrewTracker is provided free of charge, our maximum liability 
              is limited to $0 (zero dollars). Users assume all risks associated 
              with homebrewing and use of this service.
            </p>
          </div>
        </div>

        {/* Indemnification */}
        <div className="card">
          <div className="card-title">Indemnification</div>
          <div className="content-section">
            <p>
              You agree to defend, indemnify, and hold harmless BrewTracker, its 
              creators, and contributors from any claims, damages, losses, or 
              expenses arising from:
            </p>
            <ul>
              <li>Your use of BrewTracker and any brewing activities</li>
              <li>Your violation of these Terms of Service</li>
              <li>Your violation of applicable laws or regulations</li>
              <li>Your recipes, content, or interactions with other users</li>
              <li>Any brewing accidents or incidents related to your use of the service</li>
            </ul>
          </div>
        </div>

        {/* Community Guidelines */}
        <div className="card">
          <div className="card-title">Community Guidelines</div>
          <div className="content-section">
            <h3>Respectful Interaction</h3>
            <ul>
              <li>Treat all community members with respect and courtesy</li>
              <li>Provide constructive feedback and brewing advice</li>
              <li>Respect different brewing styles, preferences, and experience levels</li>
              <li>Share knowledge freely while respecting others' contributions</li>
            </ul>

            <h3>Quality Content</h3>
            <ul>
              <li>Share accurate recipe information and brewing data</li>
              <li>Provide helpful descriptions and brewing notes</li>
              <li>Use clear, descriptive names for recipes</li>
              <li>Include relevant style and process information</li>
            </ul>

            <h3>Attribution & Credit</h3>
            <ul>
              <li>Give proper credit when adapting others' recipes</li>
              <li>Acknowledge sources of brewing techniques or inspiration</li>
              <li>Respect the brewing community's collaborative spirit</li>
              <li>Share improvements and modifications with the community</li>
            </ul>
          </div>
        </div>

        {/* Dispute Resolution */}
        <div className="card">
          <div className="card-title">Dispute Resolution</div>
          <div className="content-section">
            <h3>Informal Resolution</h3>
            <p>
              If you have concerns or disputes regarding BrewTracker, please contact 
              us first through our <a href="/about">About</a> page or 
              <a href="/report-bug"> bug report system</a>. We are committed to 
              resolving issues fairly and in the spirit of community cooperation.
            </p>

            <h3>Community Mediation</h3>
            <p>
              For disputes between users (such as recipe attribution concerns), 
              we encourage community-based resolution and open communication. 
              We will provide reasonable assistance in facilitating such discussions.
            </p>

            <h3>Governing Law</h3>
            <p>
              These Terms of Service are governed by the laws of England and Wales. 
              Any disputes arising from or relating to these terms or your use of 
              BrewTracker will be subject to the exclusive jurisdiction of the 
              courts of England and Wales.
            </p>
            
            <h3>Consumer Rights</h3>
            <p>
              If you are a consumer resident in the UK, nothing in these terms 
              affects your statutory rights under UK consumer protection law, 
              including the Consumer Rights Act 2015.
            </p>
          </div>
        </div>

        {/* Updates to Terms */}
        <div className="card">
          <div className="card-title">Updates to Terms of Service</div>
          <div className="content-section">
            <h3>Notification of Changes</h3>
            <p>
              We may update these Terms of Service to reflect changes in our 
              practices, legal requirements, or service features. When we make 
              significant changes, we will:
            </p>
            <ul>
              <li>Update the "Last Updated" date at the top of these terms</li>
              <li>Notify users via email or in-application notification</li>
              <li>Provide a clear summary of changes made</li>
              <li>Allow reasonable time for review before changes take effect</li>
            </ul>

            <h3>Acceptance of Changes</h3>
            <p>
              Continued use of BrewTracker after changes become effective constitutes 
              acceptance of the updated Terms of Service. If you do not agree to 
              the changes, you should discontinue use of the service.
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <div className="card-title">Contact Information</div>
          <div className="content-section">
            <p>
              If you have questions about these Terms of Service or need to report 
              violations, please contact us:
            </p>
            <ul>
              <li>Visit our <a href="/about">About</a> page for developer contact information</li>
              <li>Submit a <a href="/report-bug">bug report</a> for technical or policy issues</li>
              <li>Check our <a href="/faq">FAQ</a> for common questions</li>
              <li>Request features or improvements via our <a href="/feature-request">Feature Request</a> form</li>
            </ul>
            
            <div style={{backgroundColor: "#f3f4f6", padding: "1rem", borderRadius: "0.375rem", marginTop: "1rem"}}>
              <p style={{marginBottom: 0}}>
                <strong>Remember:</strong> BrewTracker is a tool to assist your brewing 
                journey, but the responsibility for safe, legal, and successful brewing 
                always rests with you. Brew safely, know your local laws, and enjoy 
                the wonderful world of homebrewing! 🍺
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;