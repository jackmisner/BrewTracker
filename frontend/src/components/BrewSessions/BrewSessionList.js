import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import ApiService from "../../services/api";

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
    switch (status) {
      case "planned":
        return "bg-blue-100 text-blue-800";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800";
      case "fermenting":
        return "bg-purple-100 text-purple-800";
      case "conditioning":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-green-500 text-white";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredSessions =
    filterStatus === "all"
      ? sessions
      : sessions.filter((session) => session.status === filterStatus);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Brew Sessions</h1>
        <Link
          to="/brew-sessions/new"
          className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
        >
          New Brew Session
        </Link>
      </div>

      <div className="mb-6">
        <label
          htmlFor="status-filter"
          className="block text-gray-700 font-semibold mb-2"
        >
          Filter by Status:
        </label>
        <select
          id="status-filter"
          value={filterStatus}
          onChange={handleFilterChange}
          className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
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

      {loading && <div className="text-center py-10">Loading...</div>}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
        </div>
      )}

      {!loading && !error && filteredSessions.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No brew sessions found.</p>
          <Link
            to="/brew-sessions/new"
            className="inline-block mt-4 text-amber-600 hover:text-amber-800"
          >
            Create your first brew session
          </Link>
        </div>
      )}

      {!loading && !error && filteredSessions.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brew Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OG / FG
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ABV
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.map((session) => (
                <tr key={session.session_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/brew-sessions/${session.session_id}`}
                      className="text-amber-600 hover:text-amber-800 font-medium"
                    >
                      {session.name ||
                        `Brew #${session.session_id.substring(0, 6)}`}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(session.brew_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(
                        session.status
                      )}`}
                    >
                      {session.status.charAt(0).toUpperCase() +
                        session.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.actual_og ? session.actual_og.toFixed(3) : "-"} /
                    {session.actual_fg ? session.actual_fg.toFixed(3) : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.actual_abv
                      ? `${session.actual_abv.toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/brew-sessions/${session.session_id}`}
                      className="text-amber-600 hover:text-amber-800 mr-4"
                    >
                      View
                    </Link>
                    <Link
                      to={`/brew-sessions/${session.session_id}/edit`}
                      className="text-blue-600 hover:text-blue-800"
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
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(paginationInfo.prev_num)}
                  disabled={!paginationInfo.has_prev}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    paginationInfo.has_prev
                      ? "bg-white text-gray-700 hover:bg-gray-50"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(paginationInfo.next_num)}
                  disabled={!paginationInfo.has_next}
                  className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                    paginationInfo.has_next
                      ? "bg-white text-gray-700 hover:bg-gray-50"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
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
                    of{" "}
                    <span className="font-medium">{paginationInfo.total}</span>{" "}
                    results
                  </p>
                </div>
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() => handlePageChange(paginationInfo.prev_num)}
                      disabled={!paginationInfo.has_prev}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                        paginationInfo.has_prev
                          ? "bg-white text-gray-500 hover:bg-gray-50"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <span className="sr-only">Previous</span>
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
                        className={`relative inline-flex items-center px-4 py-2 border ${
                          page === paginationInfo.page
                            ? "z-10 bg-amber-50 border-amber-500 text-amber-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        } text-sm font-medium`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => handlePageChange(paginationInfo.next_num)}
                      disabled={!paginationInfo.has_next}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                        paginationInfo.has_next
                          ? "bg-white text-gray-500 hover:bg-gray-50"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      &rarr;
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrewSessionList;
