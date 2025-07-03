import React, { useEffect, useState } from "react";
import { attenuationAnalyticsServiceInstance } from "../services";
import { AttenuationAnalytics } from "../types";
import "../styles/AttenuationAnalytics.css";

interface SystemStats {
  total_yeast_ingredients: number;
  yeast_with_actual_data: number;
  total_attenuation_data_points: number;
  high_confidence_yeast: number;
  data_coverage_percentage: number;
}

const AttenuationAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AttenuationAnalytics[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch both analytics and system stats in parallel
        const [analyticsData, statsData] = await Promise.all([
          attenuationAnalyticsServiceInstance.getAllYeastAnalytics(),
          attenuationAnalyticsServiceInstance.getSystemStats(),
        ]);

        setAnalytics(analyticsData);
        setSystemStats(statsData);
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        setError("Failed to load attenuation analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getTopPerformers = () => {
    return analytics
      .filter(a => attenuationAnalyticsServiceInstance.hasSignificantData(a))
      .sort((a, b) => (b.actual_attenuation_count || 0) - (a.actual_attenuation_count || 0))
      .slice(0, 10);
  };

  const getMostImprovedEstimates = () => {
    return analytics
      .filter(a => 
        a.theoretical_attenuation && 
        a.actual_attenuation_average && 
        attenuationAnalyticsServiceInstance.hasSignificantData(a)
      )
      .map(a => ({
        ...a,
        improvement: Math.abs((a.actual_attenuation_average || 0) - (a.theoretical_attenuation || 0))
      }))
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 5);
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-header">
          <h1>Attenuation Analytics</h1>
          <p>Loading analytics data...</p>
        </div>
        <div className="loading-container">
          <div className="loading-spinner large"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="analytics-header">
          <h1>Attenuation Analytics</h1>
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="retry-button"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const topPerformers = getTopPerformers();
  const improvedEstimates = getMostImprovedEstimates();

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1>Yeast Attenuation Analytics</h1>
        <p className="header-description">
          Real-world fermentation data improving recipe predictions
        </p>
      </div>

      {/* System Statistics */}
      {systemStats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{systemStats.total_yeast_ingredients}</div>
            <div className="stat-label">Total Yeast Strains</div>
          </div>
          <div className="stat-card highlight">
            <div className="stat-number">{systemStats.yeast_with_actual_data}</div>
            <div className="stat-label">With Real Data</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{systemStats.total_attenuation_data_points}</div>
            <div className="stat-label">Fermentation Data Points</div>
          </div>
          <div className="stat-card success">
            <div className="stat-number">{systemStats.high_confidence_yeast}</div>
            <div className="stat-label">High Confidence Strains</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{systemStats.data_coverage_percentage}%</div>
            <div className="stat-label">Data Coverage</div>
          </div>
        </div>
      )}

      <div className="analytics-content">
        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <div className="analytics-section">
            <h2>🏆 Most Tracked Yeast Strains</h2>
            <p className="section-description">
              Yeast strains with the most real-world fermentation data
            </p>
            <div className="yeast-list">
              {topPerformers.map((yeast, index) => (
                <div key={yeast.ingredient_id} className="yeast-card">
                  <div className="yeast-rank">#{index + 1}</div>
                  <div className="yeast-info">
                    <h3 className="yeast-name">{yeast.name}</h3>
                    {yeast.manufacturer && (
                      <span className="yeast-manufacturer">{yeast.manufacturer}</span>
                    )}
                    {yeast.code && (
                      <span className="yeast-code">{yeast.code}</span>
                    )}
                  </div>
                  <div className="yeast-stats">
                    <div className="stat-item">
                      <span className="stat-label">Data Points:</span>
                      <span className="stat-value">{yeast.actual_attenuation_count}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Avg Attenuation:</span>
                      <span className="stat-value">
                        {yeast.actual_attenuation_average?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Confidence:</span>
                      <span className={`stat-value ${attenuationAnalyticsServiceInstance.getConfidenceLevel(yeast.attenuation_confidence).color}`}>
                        {attenuationAnalyticsServiceInstance.formatConfidence(yeast.attenuation_confidence)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Biggest Improvements */}
        {improvedEstimates.length > 0 && (
          <div className="analytics-section">
            <h2>📈 Biggest Prediction Improvements</h2>
            <p className="section-description">
              Yeast strains where real-world data differs most from manufacturer specs
            </p>
            <div className="improvement-list">
              {improvedEstimates.map((yeast) => {
                const difference = attenuationAnalyticsServiceInstance.formatAttenuationDifference(
                  yeast.theoretical_attenuation,
                  yeast.actual_attenuation_average
                );
                
                return (
                  <div key={yeast.ingredient_id} className="improvement-card">
                    <div className="improvement-info">
                      <h3 className="yeast-name">{yeast.name}</h3>
                      {yeast.manufacturer && (
                        <span className="yeast-manufacturer">{yeast.manufacturer}</span>
                      )}
                    </div>
                    <div className="improvement-stats">
                      <div className="stat-row">
                        <span className="stat-label">Theoretical:</span>
                        <span className="stat-value">{yeast.theoretical_attenuation?.toFixed(1)}%</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Actual Average:</span>
                        <span className="stat-value">{yeast.actual_attenuation_average?.toFixed(1)}%</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Difference:</span>
                        <span className={`stat-value ${difference.direction === "higher" ? "positive" : "negative"}`}>
                          {difference.formatted}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Data State */}
        {analytics.length === 0 && (
          <div className="no-data-state">
            <div className="no-data-icon">📊</div>
            <h2>No Analytics Data Available</h2>
            <p>
              As users complete fermentations and share their data, analytics will appear here.
              Help improve the system by enabling data sharing in your user settings!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttenuationAnalyticsPage;