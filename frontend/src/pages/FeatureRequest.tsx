/**
 * FeatureRequest component renders a form for users to submit feature requests for the BrewTracker application.
 * 
 * - Collects details such as feature title, description, use case, proposed solution, alternatives, browser info, priority, and category.
 * - On submission, opens a pre-filled GitHub issue creation page in a new tab with the provided information.
 * - Displays submission status messages and resets the form after submission.
 * - Requires a GitHub account to complete the feature request submission.
 * 
 * @component
 * @returns {JSX.Element} The rendered feature request form and related UI.
 */
import React, { useState } from "react";

interface FeatureRequestForm {
  title: string;
  description: string;
  useCase: string;
  proposedSolution: string;
  alternatives: string;
  browserInfo: string;
  priority: "low" | "medium" | "high";
  category: "ui-ux" | "functionality" | "performance" | "integration" | "other";
}

const FeatureRequest: React.FC = () => {
  const [formData, setFormData] = useState<FeatureRequestForm>({
    title: "",
    description: "",
    useCase: "",
    proposedSolution: "",
    alternatives: "",
    browserInfo: navigator.userAgent,
    priority: "medium",
    category: "functionality",
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
      const issueTitle = encodeURIComponent(`Feature Request: ${formData.title}`);
      const issueBody = encodeURIComponent(`
## Feature Description
${formData.description}

## Use Case
${formData.useCase}

## Proposed Solution
${formData.proposedSolution}

## Alternative Solutions
${formData.alternatives || "No alternatives considered"}

## Additional Context
- Category: ${formData.category}
- Priority: ${formData.priority}
- Browser: ${formData.browserInfo}

## Submission Details
Requested via BrewTracker Feature Request Form
      `.trim());

      const githubUrl = `https://github.com/jackmisner/BrewTracker/issues/new?title=${issueTitle}&body=${issueBody}&labels=feature-request,${formData.priority}-priority,${formData.category}`;
      
      // Open GitHub issue creation page
      window.open(githubUrl, '_blank');
      
      setSubmitMessage("Redirecting to GitHub to create your feature request...");
      
      // Reset form after a delay
      setTimeout(() => {
        setFormData({
          title: "",
          description: "",
          useCase: "",
          proposedSolution: "",
          alternatives: "",
          browserInfo: navigator.userAgent,
          priority: "medium",
          category: "functionality",
        });
        setSubmitMessage("");
      }, 3000);
      
    } catch (error) {
      setSubmitMessage("Error creating feature request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Request a Feature</h1>
        <p className="page-subtitle">
          Help us improve BrewTracker by suggesting new features and enhancements.
        </p>
      </div>
      
      <div className="content-container">
        <div className="card">
          <div className="card-title">Feature Request Form</div>
          
          {submitMessage && (
            <div className={`alert ${submitMessage.includes('Error') ? 'alert-error' : 'alert-success'}`}>
              {submitMessage}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="feature-request-form">
            <div className="form-group">
              <label htmlFor="title" className="form-label">
                Feature Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="form-control"
                placeholder="Brief description of the feature you'd like"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="category" className="form-label">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="functionality">Functionality - New brewing features</option>
                <option value="ui-ux">UI/UX - Interface improvements</option>
                <option value="performance">Performance - Speed and efficiency</option>
                <option value="integration">Integration - External tools/formats</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority" className="form-label">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="low">Low - Nice to have</option>
                <option value="medium">Medium - Would improve workflow</option>
                <option value="high">High - Important for brewing process</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Feature Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-control"
                rows={4}
                placeholder="Detailed description of the feature you'd like to see"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="useCase" className="form-label">
                Use Case *
              </label>
              <textarea
                id="useCase"
                name="useCase"
                value={formData.useCase}
                onChange={handleInputChange}
                className="form-control"
                rows={4}
                placeholder="Describe when and why you would use this feature. What problem does it solve?"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="proposedSolution" className="form-label">
                Proposed Solution *
              </label>
              <textarea
                id="proposedSolution"
                name="proposedSolution"
                value={formData.proposedSolution}
                onChange={handleInputChange}
                className="form-control"
                rows={4}
                placeholder="How do you envision this feature working? Include any specific implementation ideas."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="alternatives" className="form-label">
                Alternative Solutions
              </label>
              <textarea
                id="alternatives"
                name="alternatives"
                value={formData.alternatives}
                onChange={handleInputChange}
                className="form-control"
                rows={3}
                placeholder="Are there other ways to solve this problem? Have you considered any workarounds?"
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
                This information helps us understand your environment for feature development.
              </small>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating Request..." : "Submit Feature Request"}
              </button>
            </div>
          </form>
          
          <div className="form-note">
            <p>
              <strong>Note:</strong> This form will redirect you to GitHub to create 
              a feature request. You'll need a GitHub account to submit the request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureRequest;