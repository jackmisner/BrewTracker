import React from "react";
import { BrewSession, ID } from "../types";
import { formatGravity, formatAbv } from "../utils/formatUtils";

interface CompactBrewSessionCardProps {
  session: BrewSession;
  onView?: (sessionId: ID) => void;
  onEdit?: (sessionId: ID) => void;
}

const CompactBrewSessionCard: React.FC<CompactBrewSessionCardProps> = ({
  session,
  onView,
  onEdit,
}) => {

  const formatDate = (dateString: string | Date): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getSessionDisplayName = (session: BrewSession): string => {
    if (session.name) {
      return session.name;
    }
    return `Session #${session.session_id.toString().substring(0, 6)}`;
  };

  const getProgressDescription = (status: string): string => {
    const descriptions: Record<string, string> = {
      planned: "Ready to brew",
      "in-progress": "Currently brewing",
      fermenting: "In fermentation",
      conditioning: "Conditioning",
      completed: "Finished brewing",
      archived: "Archived",
    };
    return descriptions[status] || "Unknown status";
  };

  return (
    <div className="compact-session-card">
      <div className="compact-session-header">
        <div className="compact-session-info">
          <h3 className="compact-session-name">{getSessionDisplayName(session)}</h3>
          <p className="compact-session-meta">
            {formatDate(session.brew_date)} • {getProgressDescription(session.status || "")}
          </p>
        </div>
        <span
          className={`compact-session-status-badge ${session.status || "unknown"}`}
        >
          {(session.status || "unknown").replace("-", " ")}
        </span>
      </div>

      {/* Session Metrics */}
      <div className="compact-session-metrics">
        <div className="compact-session-metric">
          <div className="compact-session-metric-value">
            {session.actual_og ? formatGravity(session.actual_og) : "TBD"}
          </div>
          <div className="compact-session-metric-label">OG</div>
        </div>
        <div className="compact-session-metric">
          <div className="compact-session-metric-value">
            {session.actual_fg ? formatGravity(session.actual_fg) : "TBD"}
          </div>
          <div className="compact-session-metric-label">FG</div>
        </div>
        <div className="compact-session-metric">
          <div className="compact-session-metric-value">
            {session.actual_abv ? formatAbv(session.actual_abv) : "TBD"}
          </div>
          <div className="compact-session-metric-label">ABV</div>
        </div>
      </div>

      {/* Rating for completed sessions */}
      {session.batch_rating && session.batch_rating > 0 && (
        <div className="compact-session-rating">
          <span className="compact-session-rating-label">Rating:</span>
          <div className="compact-session-stars">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`compact-session-star ${
                  i < (session.batch_rating || 0) ? "filled" : ""
                }`}
              >
                ★
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="compact-session-actions">
        <button
          onClick={() => onView?.(session.session_id)}
          className="compact-session-action-button view"
        >
          View
        </button>
        <button
          onClick={() => onEdit?.(session.session_id)}
          className="compact-session-action-button edit"
        >
          Edit
        </button>
      </div>
    </div>
  );
};

export default CompactBrewSessionCard;