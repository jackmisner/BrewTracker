/**
 * React component for reporting bugs in the BrewTracker application.
 *
 * Renders a form that collects detailed bug information from the user, including:
 * - Bug title
 * - Severity level
 * - Description
 * - Steps to reproduce
 * - Expected and actual behavior
 * - Browser information (auto-filled)
 *
 * On submission, the form opens a pre-filled GitHub issue creation page in a new tab,
 * allowing users to submit their bug report directly to the project's GitHub repository.
 *
 * Displays submission status messages and resets the form after submission.
 *
 * @component
 * @returns {JSX.Element} The rendered bug report form.
 */
import React, { useState } from "react";

interface BugReportForm {
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  browserInfo: string;
  severity: "low" | "medium" | "high" | "critical";
}

const ReportBug: React.FC = () => {
  const [formData, setFormData] = useState<BugReportForm>({
    title: "",
    description: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    actualBehavior: "",
    browserInfo: navigator.userAgent,
    severity: "medium",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Create GitHub issue URL with pre-filled data
      const issueTitle = encodeURIComponent(`Bug Report: ${formData.title}`);
      const issueBody = encodeURIComponent(`
## Bug Description
${formData.description}

## Steps to Reproduce
${formData.stepsToReproduce}

## Expected Behavior
${formData.expectedBehavior}

## Actual Behavior
${formData.actualBehavior}

## Environment
- Browser: ${formData.browserInfo}
- Severity: ${formData.severity}

## Additional Information
Reported via BrewTracker Bug Report Form
      `.trim());

      const githubUrl = `https://github.com/jackmisner/BrewTracker/issues/new?title=${issueTitle}&body=${issueBody}&labels=bug,${formData.severity}-priority`;
      
      // Open GitHub issue creation page
      window.open(githubUrl, '_blank');
      
      setSubmitMessage("Redirecting to GitHub to create your bug report...");
      
      // Reset form after a delay
      setTimeout(() => {
        setFormData({
          title: "",
          description: "",
          stepsToReproduce: "",
          expectedBehavior: "",
          actualBehavior: "",
          browserInfo: navigator.userAgent,
          severity: "medium",
        });
        setSubmitMessage("");
      }, 3000);
      
    } catch (error) {
      setSubmitMessage("Error creating bug report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Report a Bug</h1>
        <p className="page-subtitle">
          Help us improve BrewTracker by reporting any issues you encounter.
        </p>
      </div>
      
      <div className="content-container">
        <div className="card">
          <div className="card-title">Bug Report Form</div>
          
          {submitMessage && (
            <div className={`alert ${submitMessage.includes('Error') ? 'alert-error' : 'alert-success'}`}>
              {submitMessage}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="bug-report-form">
            <div className="form-group">
              <label htmlFor="title" className="form-label">
                Bug Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="form-control"
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="severity" className="form-label">
                Severity
              </label>
              <select
                id="severity"
                name="severity"
                value={formData.severity}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="low">Low - Minor inconvenience</option>
                <option value="medium">Medium - Affects functionality</option>
                <option value="high">High - Major feature broken</option>
                <option value="critical">Critical - App unusable</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-control"
                rows={4}
                placeholder="Detailed description of the bug"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="stepsToReproduce" className="form-label">
                Steps to Reproduce *
              </label>
              <textarea
                id="stepsToReproduce"
                name="stepsToReproduce"
                value={formData.stepsToReproduce}
                onChange={handleInputChange}
                className="form-control"
                rows={4}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="expectedBehavior" className="form-label">
                Expected Behavior *
              </label>
              <textarea
                id="expectedBehavior"
                name="expectedBehavior"
                value={formData.expectedBehavior}
                onChange={handleInputChange}
                className="form-control"
                rows={3}
                placeholder="What you expected to happen"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="actualBehavior" className="form-label">
                Actual Behavior *
              </label>
              <textarea
                id="actualBehavior"
                name="actualBehavior"
                value={formData.actualBehavior}
                onChange={handleInputChange}
                className="form-control"
                rows={3}
                placeholder="What actually happened"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="browserInfo" className="form-label">
                Browser Information
              </label>
              <input
                type="text"
                id="browserInfo"
                name="browserInfo"
                value={formData.browserInfo}
                onChange={handleInputChange}
                className="form-control"
                readOnly
              />
              <small className="form-help">
                This information helps us debug browser-specific issues.
              </small>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating Report..." : "Create Bug Report"}
              </button>
            </div>
          </form>
          
          <div className="form-note">
            <p>
              <strong>Note:</strong> This form will redirect you to GitHub to create 
              an issue. You'll need a GitHub account to submit the report.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBug;