import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import Fuse from "fuse.js";
import ApiService from "../../services/api";
import { BrewSession } from "../../types";
import { formatGravity, formatAbv } from "../../utils/formatUtils";
import "../../styles/BrewSessions.css";

type BrewSessionStatus =
  | "all"
  | "planned"
  | "in-progress"
  | "fermenting"
  | "conditioning"
  | "completed"
  | "archived";

const BrewSessionList: React.FC = () => {
  const [sessions, setSessions] = useState<BrewSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<BrewSessionStatus>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("brew_date_desc");

  const fetchSessions = async (): Promise<void> => {
    try {
      setLoading(true);
      // Fetch all sessions for client-side search and sort (using large page size)
      const response = await ApiService.brewSessions.getAll(1, 1000);

      setSessions(response.data.brew_sessions || []);
    } catch (err: any) {
      console.error("Error fetching brew sessions:", err);
      setError("Failed to load brew sessions");
    } finally {
      setLoading(false);
    }
  };

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;

    return new Fuse(sessions, {
      keys: [
        { name: "name", weight: 1.0 },
        { name: "status", weight: 0.8 },
        { name: "notes", weight: 0.6 },
        { name: "tasting_notes", weight: 0.5 },
      ],
      threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
      distance: 100,
      minMatchCharLength: 1,
      includeScore: false,
      includeMatches: false,
      ignoreLocation: true,
      useExtendedSearch: false,
    });
  }, [sessions]);

  // Sort sessions based on selected criteria
  const sortSessions = (sessionsToSort: BrewSession[]): BrewSession[] => {
    const sorted = [...sessionsToSort];

    switch (sortBy) {
      case "name_asc":
        return sorted.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        );
      case "name_desc":
        return sorted.sort((a, b) =>
          (b.name || "").localeCompare(a.name || "")
        );
      case "brew_date_asc":
        return sorted.sort(
          (a, b) =>
            new Date(a.brew_date || "").getTime() -
            new Date(b.brew_date || "").getTime()
        );
      case "brew_date_desc":
        return sorted.sort(
          (a, b) =>
            new Date(b.brew_date || "").getTime() -
            new Date(a.brew_date || "").getTime()
        );
      case "status_asc":
        return sorted.sort((a, b) =>
          (a.status || "").localeCompare(b.status || "")
        );
      case "status_desc":
        return sorted.sort((a, b) =>
          (b.status || "").localeCompare(a.status || "")
        );
      case "abv_asc":
        return sorted.sort((a, b) => (a.actual_abv || 0) - (b.actual_abv || 0));
      case "abv_desc":
        return sorted.sort((a, b) => (b.actual_abv || 0) - (a.actual_abv || 0));
      case "og_asc":
        return sorted.sort((a, b) => (a.actual_og || 0) - (b.actual_og || 0));
      case "og_desc":
        return sorted.sort((a, b) => (b.actual_og || 0) - (a.actual_og || 0));
      case "fg_asc":
        return sorted.sort((a, b) => (a.actual_fg || 0) - (b.actual_fg || 0));
      case "fg_desc":
        return sorted.sort((a, b) => (b.actual_fg || 0) - (a.actual_fg || 0));
      case "efficiency_asc":
        return sorted.sort(
          (a, b) => (a.actual_efficiency || 0) - (b.actual_efficiency || 0)
        );
      case "efficiency_desc":
        return sorted.sort(
          (a, b) => (b.actual_efficiency || 0) - (a.actual_efficiency || 0)
        );
      case "rating_asc":
        return sorted.sort(
          (a, b) => (a.batch_rating || 0) - (b.batch_rating || 0)
        );
      case "rating_desc":
        return sorted.sort(
          (a, b) => (b.batch_rating || 0) - (a.batch_rating || 0)
        );
      case "created_at_asc":
        return sorted.sort(
          (a, b) =>
            new Date(a.created_at || "").getTime() -
            new Date(b.created_at || "").getTime()
        );
      case "created_at_desc":
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at || "").getTime() -
            new Date(a.created_at || "").getTime()
        );
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.brew_date || "").getTime() -
            new Date(a.brew_date || "").getTime()
        );
    }
  };

  // Filter, search, and sort sessions
  const filteredAndSortedSessions = useMemo(() => {
    let sessionsToProcess = sessions || [];

    // Apply status filter first
    if (filterStatus !== "all") {
      sessionsToProcess = sessionsToProcess.filter(
        session => session.status === filterStatus
      );
    }

    // Apply search filter if there's a search term
    if (searchTerm && searchTerm.length >= 2 && fuse) {
      const searchResults = fuse.search(searchTerm);
      const searchSessionIds = searchResults.map(
        result => result.item.session_id
      );
      sessionsToProcess = sessionsToProcess.filter(session =>
        searchSessionIds.includes(session.session_id)
      );
    }

    // Apply sorting
    return sortSessions(sessionsToProcess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuse, searchTerm, sessions, sortBy, filterStatus]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    setFilterStatus(e.target.value as BrewSessionStatus);
  };

  const getStatusBadgeClass = (status: string): string => {
    return `status-badge status-${status}`;
  };

  return (
    <div className="container">
      <div className="brew-sessions-header">
        <h1 className="page-title">Brew Sessions</h1>
      </div>

      {/* Search and Sort Controls */}
      {!loading && !error && sessions && sessions.length > 0 && (
        <div className="search-and-sort-container">
          <div className="search-container">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Search sessions by name, status, notes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <div className="search-icon-container">
                <svg
                  className="search-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {searchTerm && (
                <div className="search-clear-container">
                  <button
                    onClick={() => setSearchTerm("")}
                    className="search-clear-button"
                  >
                    <svg
                      className="search-clear-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="sort-container">
            <label htmlFor="sort-select" className="sort-label">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="brew_date_desc">Brew Date (Newest)</option>
              <option value="brew_date_asc">Brew Date (Oldest)</option>
              <option value="created_at_desc">Created (Newest)</option>
              <option value="created_at_asc">Created (Oldest)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="status_asc">Status (A-Z)</option>
              <option value="status_desc">Status (Z-A)</option>
              <option value="abv_desc">ABV (High to Low)</option>
              <option value="abv_asc">ABV (Low to High)</option>
              <option value="og_desc">OG (High to Low)</option>
              <option value="og_asc">OG (Low to High)</option>
              <option value="fg_desc">FG (High to Low)</option>
              <option value="fg_asc">FG (Low to High)</option>
              <option value="efficiency_desc">Efficiency (High to Low)</option>
              <option value="efficiency_asc">Efficiency (Low to High)</option>
              <option value="rating_desc">Rating (High to Low)</option>
              <option value="rating_asc">Rating (Low to High)</option>
            </select>
          </div>

          <div className="brew-sessions-filter">
            <label htmlFor="status-filter" className="filter-label">
              Status:
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

          {searchTerm && searchTerm.length >= 2 && (
            <p className="search-results-count">
              Showing {filteredAndSortedSessions.length} of{" "}
              {sessions?.length || 0} sessions
            </p>
          )}
        </div>
      )}

      {loading && <div className="loading-message">Loading...</div>}

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && (!sessions || sessions.length === 0) && (
        <div className="brew-sessions-empty">
          <p>No brew sessions found.</p>
          {/* <Link to="/brew-sessions/new" className="btn btn-primary">
            Create your first brew session
          </Link> */}
        </div>
      )}

      {!loading &&
        !error &&
        sessions &&
        sessions.length > 0 &&
        filteredAndSortedSessions.length === 0 &&
        searchTerm && (
          <div className="no-search-results">
            <p>No sessions found matching "{searchTerm}"</p>
            <button
              onClick={() => setSearchTerm("")}
              className="clear-search-link"
            >
              Clear search
            </button>
          </div>
        )}

      {!loading && !error && filteredAndSortedSessions.length > 0 && (
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
              {filteredAndSortedSessions.map(session => (
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
                    <span className={getStatusBadgeClass(session.status || "")}>
                      {session.status
                        ? session.status.charAt(0).toUpperCase() +
                          session.status.slice(1)
                        : "Unknown"}
                    </span>
                  </td>
                  <td className="session-metrics-cell">
                    {session.actual_og ? formatGravity(session.actual_og) : "-"}{" "}
                    /
                    {session.actual_fg ? formatGravity(session.actual_fg) : "-"}
                  </td>
                  <td className="session-metrics-cell">
                    {session.actual_abv ? formatAbv(session.actual_abv) : "-"}
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
        </div>
      )}
    </div>
  );
};

export default BrewSessionList;
