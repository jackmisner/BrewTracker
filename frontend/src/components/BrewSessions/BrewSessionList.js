import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import ApiService from "../../services/api";
import "../../styles/BrewSessions.css";

const BrewSessionList = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchSessions = async (page = 1) => {
    try {
      setLoading(true);
      const response = await ApiService.brewSessions.getAll(page);

      setSessions(response.data.brew_sessions);
      setPaginationInfo(response.data.pagination);
    } catch (err) {
      console.error("Error fetching brew sessions:", err);
      setError("Failed to load brew sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(currentPage);
  }, [currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleFilterChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1); // Reset to first page when changing filters
    // Note: In a real implementation, we would pass the filter to the API
    // Currently the API doesn't support filtering by status, so we'd filter client-side
  };

  const getStatusBadgeClass = (status) => {
    return `status-badge status-${status}`;
  };

  const filteredSessions =
    filterStatus === "all"
      ? sessions
      : sessions.filter((session) => session.status === filterStatus);

  return (
    <div className="container">
      <div className="brew-sessions-header">
        <h1 className="page-title">Brew Sessions</h1>
        <Link to="/brew-sessions/new" className="btn btn-primary">
          New Brew Session
        </Link>
      </div>

      <div className="brew-sessions-filter">
        <label htmlFor="status-filter" className="filter-label">
          Filter by Status:
        </label>
        <select
          id="status-filter"
          value={filterStatus}
          onChange={handleFilterChange}
          className="filter-select"
        >
          <option value="all">All Statuses</option>
          <option value="planned">Planned</option>
          <option value="in-progress">In Progress</option>
          <option value="fermenting">Fermenting</option>
          <option value="conditioning">Conditioning</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading && <div className="loading-message">Loading...</div>}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && filteredSessions.length === 0 && (
        <div className="brew-sessions-empty">
          <p>No brew sessions found.</p>
          <Link to="/brew-sessions/new" className="btn btn-primary">
            Create your first brew session
          </Link>
        </div>
      )}

      {!loading && !error && filteredSessions.length > 0 && (
        <div className="table-container">
          <table className="brew-sessions-table">
            <thead>
              <tr>
                <th>Session Name</th>
                <th>Brew Date</th>
                <th>Status</th>
                <th>OG / FG</th>
                <th>ABV</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr key={session.session_id}>
                  <td className="session-name-cell">
                    <Link to={`/brew-sessions/${session.session_id}`}>
                      {session.name ||
                        `Brew #${session.session_id.substring(0, 6)}`}
                    </Link>
                  </td>
                  <td className="session-date-cell">
                    {new Date(session.brew_date).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(session.status)}>
                      {session.status.charAt(0).toUpperCase() +
                        session.status.slice(1)}
                    </span>
                  </td>
                  <td className="session-metrics-cell">
                    {session.actual_og ? session.actual_og.toFixed(3) : "-"} /
                    {session.actual_fg ? session.actual_fg.toFixed(3) : "-"}
                  </td>
                  <td className="session-metrics-cell">
                    {session.actual_abv
                      ? `${session.actual_abv.toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="session-actions-cell">
                    <Link
                      to={`/brew-sessions/${session.session_id}`}
                      className="session-action-link"
                    >
                      View
                    </Link>
                    <Link
                      to={`/brew-sessions/${session.session_id}/edit`}
                      className="session-action-link"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination controls */}
          {paginationInfo.pages > 1 && (
            <div className="brew-sessions-pagination">
              <div
                className="pagination-info"
                role="status"
                aria-label="pagination results"
              >
                Showing{" "}
                <span className="font-medium">
                  {(paginationInfo.page - 1) * paginationInfo.per_page + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(
                    paginationInfo.page * paginationInfo.per_page,
                    paginationInfo.total
                  )}
                </span>{" "}
                of <span className="font-medium">{paginationInfo.total}</span>{" "}
                results
              </div>
              <div className="pagination-controls">
                <button
                  onClick={() => handlePageChange(paginationInfo.prev_num)}
                  disabled={!paginationInfo.has_prev}
                  className="pagination-button prev"
                >
                  &larr;
                </button>

                {/* Page numbers */}
                {Array.from(
                  { length: paginationInfo.pages },
                  (_, i) => i + 1
                ).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`pagination-button ${
                      page === paginationInfo.page ? "active" : ""
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(paginationInfo.next_num)}
                  disabled={!paginationInfo.has_next}
                  className="pagination-button next"
                >
                  &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrewSessionList;
