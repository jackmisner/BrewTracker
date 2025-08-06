import React, { useEffect, useState } from "react";
import { attenuationAnalyticsServiceInstance } from "@/services";
import { AttenuationAnalytics, ID } from "@/types";
import { formatAttenuation } from "@/utils/formatUtils";

interface AttenuationBadgeProps {
  ingredientId: ID;
  className?: string;
  showDetails?: boolean;
}

const AttenuationBadge: React.FC<AttenuationBadgeProps> = ({
  ingredientId,
  className = "",
  showDetails = false,
}) => {
  const [analytics, setAnalytics] = useState<AttenuationAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!ingredientId) return;

      setLoading(true);
      setError(null);

      try {
        const data =
          await attenuationAnalyticsServiceInstance.getYeastAnalytics(
            ingredientId
          );
        setAnalytics(data);
      } catch (err) {
        // Analytics not available - this is normal for many yeast ingredients
        setAnalytics(null);
        setError(null); // Don't show error for missing analytics
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [ingredientId]);

  if (loading) {
    return (
      <div className={`attenuation-badge loading ${className}`}>
        <span className="loading-spinner"></span>
        <span className="loading-text">Loading analytics...</span>
      </div>
    );
  }

  if (
    !analytics ||
    !attenuationAnalyticsServiceInstance.hasSignificantData(analytics)
  ) {
    return null; // Don't show anything if no meaningful data
  }

  const confidence = attenuationAnalyticsServiceInstance.getConfidenceLevel(
    analytics.attenuation_confidence
  );
  const difference =
    attenuationAnalyticsServiceInstance.formatAttenuationDifference(
      analytics.theoretical_attenuation,
      analytics.actual_attenuation_average
    );

  const bestEstimate =
    attenuationAnalyticsServiceInstance.getBestEstimate(analytics);

  return (
    <div className={`attenuation-badge ${confidence.level} ${className}`}>
      {/* Main badge with improved estimate */}
      <div className="badge-main">
        <span className="badge-icon">📊</span>
        <span className="badge-text">
          {bestEstimate ? formatAttenuation(bestEstimate) : "N/A"} attenuation
        </span>
        <span className={`confidence-indicator ${confidence.color}`}>
          {attenuationAnalyticsServiceInstance.formatConfidence(
            analytics.attenuation_confidence
          )}
        </span>
      </div>

      {/* Detailed view if requested */}
      {showDetails && (
        <div className="badge-details">
          <div className="detail-row">
            <span className="detail-label">Real-world data:</span>
            <span className="detail-value">
              {analytics.actual_attenuation_count || 0} fermentations
            </span>
          </div>

          {analytics.actual_attenuation_average &&
            analytics.theoretical_attenuation && (
              <div className="detail-row">
                <span className="detail-label">vs. Theoretical:</span>
                <span
                  className={`detail-value ${
                    difference.direction === "higher"
                      ? "positive"
                      : difference.direction === "lower"
                        ? "negative"
                        : ""
                  }`}
                >
                  {difference.formatted}
                </span>
              </div>
            )}

          {analytics.std_deviation && (
            <div className="detail-row">
              <span className="detail-label">Consistency:</span>
              <span className="detail-value">
                ±{formatAttenuation(analytics.std_deviation)}
              </span>
            </div>
          )}

          <div className="detail-row">
            <span className="detail-label">Confidence:</span>
            <span className={`detail-value ${confidence.color}`}>
              {confidence.description}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="badge-error">
          <span className="error-text">Failed to load analytics</span>
        </div>
      )}
    </div>
  );
};

export default AttenuationBadge;
