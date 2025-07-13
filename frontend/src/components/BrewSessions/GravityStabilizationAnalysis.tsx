import React, { useState, useEffect, useCallback } from "react";
import { GravityStabilizationAnalysis, ID } from "../../types";
import { Services } from "../../services";
import { formatGravity, formatPercentage } from "../../utils/formatUtils";

interface GravityStabilizationAnalysisProps {
  sessionId: ID;
  onSuggestCompletion?: () => void;
}

const GravityStabilizationAnalysisComponent: React.FC<GravityStabilizationAnalysisProps> = ({
  sessionId,
  onSuggestCompletion,
}) => {
  const [analysis, setAnalysis] = useState<GravityStabilizationAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetchAnalysis = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      
      const result = await Services.brewSession.analyzeFermentationCompletion(sessionId);
      setAnalysis(result);
    } catch (err: any) {
      console.error("Error fetching gravity stabilization analysis:", err);
      setError("Failed to analyze gravity stabilization");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchAnalysis();
    }
  }, [sessionId, fetchAnalysis]);

  const handleAcceptSuggestion = () => {
    if (onSuggestCompletion) {
      onSuggestCompletion();
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return "#059669"; // green
    if (confidence >= 0.6) return "#d97706"; // amber
    if (confidence >= 0.4) return "#dc2626"; // red
    return "#6b7280"; // gray
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    if (confidence >= 0.4) return "Low";
    return "Very Low";
  };

  if (loading) {
    return (
      <div className="gravity-analysis-loading">
        <div className="loading-spinner"></div>
        <span>Analyzing gravity stabilization...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gravity-analysis-error">
        <p>{error}</p>
        <button onClick={fetchAnalysis} className="btn btn-secondary">
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="gravity-stabilization-analysis">
      <div className="analysis-header">
        <h4>Gravity Stabilization Analysis</h4>
        <button 
          onClick={fetchAnalysis}
          className="btn btn-secondary btn-sm"
          title="Refresh analysis"
        >
          🔄
        </button>
      </div>

      <div className="analysis-content">
        {/* Status Overview */}
        <div className="analysis-status">
          <div className={`status-indicator ${analysis.is_stable ? 'stable' : 'unstable'}`}>
            <span className="status-icon">
              {analysis.is_stable ? '✅' : '⏳'}
            </span>
            <span className="status-text">
              {analysis.is_stable ? 'Gravity Stable' : 'Gravity Still Changing'}
            </span>
          </div>
        </div>

        {/* Main Analysis Result */}
        <div className="analysis-result">
          <div className="analysis-reason">
            <strong>Analysis:</strong> {analysis.reason}
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="analysis-metrics">
          <div className="metric-row">
            <div className="metric">
              <label>Current Gravity:</label>
              <span className="metric-value">{formatGravity(analysis.current_gravity)}</span>
            </div>
            {analysis.estimated_fg && (
              <div className="metric">
                <label>Estimated FG:</label>
                <span className="metric-value">{formatGravity(analysis.estimated_fg)}</span>
              </div>
            )}
          </div>

          <div className="metric-row">
            <div className="metric">
              <label>Stabilization Confidence:</label>
              <span 
                className="metric-value confidence"
                style={{ color: getConfidenceColor(analysis.stabilization_confidence) }}
              >
                {getConfidenceLabel(analysis.stabilization_confidence)} ({formatPercentage(analysis.stabilization_confidence * 100, 0)})
              </span>
            </div>
            <div className="metric">
              <label>Stable Readings:</label>
              <span className="metric-value">
                {analysis.stable_reading_count} of {analysis.total_readings}
              </span>
            </div>
          </div>

          {analysis.gravity_difference !== undefined && analysis.gravity_difference !== null && (
            <div className="metric-row">
              <div className="metric">
                <label>Difference from Target:</label>
                <span className="metric-value">
                  {formatGravity(Math.abs(analysis.gravity_difference))} 
                  {analysis.gravity_difference > 0 ? ' (higher)' : ' (lower)'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Completion Suggestion */}
        {analysis.completion_suggested && (
          <div className="completion-suggestion">
            <div className="suggestion-content">
              <div className="suggestion-icon">🎯</div>
              <div className="suggestion-text">
                <strong>Fermentation may be complete!</strong>
                <p>The gravity appears to have stabilized. Consider marking this fermentation as completed.</p>
              </div>
            </div>
            <button 
              onClick={handleAcceptSuggestion}
              className="btn btn-success"
            >
              Mark as Completed
            </button>
          </div>
        )}

        {/* Recent Changes Detail */}
        {analysis.recent_changes && analysis.recent_changes.length > 0 && (
          <div className="recent-changes">
            <h5>Recent Gravity Changes</h5>
            <div className="changes-list">
              {analysis.recent_changes.map((change, index) => (
                <div key={index} className="change-item">
                  <span className={`change-value ${Math.abs(change) <= 0.002 ? 'stable' : 'changing'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
            <div className="changes-note">
              <small>Changes of ±0.002 or less are considered stable</small>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .gravity-stabilization-analysis {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
        }

        .analysis-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .analysis-header h4 {
          margin: 0;
          color: #1e293b;
        }

        .analysis-status {
          text-align: center;
          margin-bottom: 1rem;
        }

        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-weight: 500;
        }

        .status-indicator.stable {
          background: #dcfce7;
          color: #166534;
        }

        .status-indicator.unstable {
          background: #fef3c7;
          color: #92400e;
        }

        .status-icon {
          font-size: 1.2em;
        }

        .analysis-result {
          background: white;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          border-left: 4px solid #3b82f6;
        }

        .analysis-reason {
          color: #374151;
          line-height: 1.5;
        }

        .analysis-metrics {
          background: white;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        .metric-row {
          display: flex;
          gap: 2rem;
          margin-bottom: 0.75rem;
        }

        .metric-row:last-child {
          margin-bottom: 0;
        }

        .metric {
          flex: 1;
        }

        .metric label {
          display: block;
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }

        .metric-value {
          font-weight: 600;
          color: #111827;
        }

        .metric-value.confidence {
          font-weight: 700;
        }

        .completion-suggestion {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .suggestion-content {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .suggestion-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .suggestion-text strong {
          display: block;
          color: #166534;
          margin-bottom: 0.5rem;
        }

        .suggestion-text p {
          margin: 0;
          color: #22543d;
          font-size: 0.875rem;
        }

        .recent-changes {
          background: white;
          padding: 1rem;
          border-radius: 6px;
        }

        .recent-changes h5 {
          margin: 0 0 0.75rem 0;
          color: #374151;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .changes-list {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 0.5rem;
        }

        .change-item {
          background: #f3f4f6;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-family: monospace;
        }

        .change-value.stable {
          background: #dcfce7;
          color: #166534;
        }

        .change-value.changing {
          background: #fef3c7;
          color: #92400e;
        }

        .changes-note {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .gravity-analysis-loading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          color: #6b7280;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .gravity-analysis-error {
          padding: 1rem;
          background: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-success {
          background: #059669;
          color: white;
        }

        .btn-success:hover {
          background: #047857;
        }
      `}</style>
    </div>
  );
};

export default GravityStabilizationAnalysisComponent;