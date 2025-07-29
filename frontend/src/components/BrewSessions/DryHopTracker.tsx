import React, { useState, useEffect, useCallback } from "react";
import { Services } from "../../services";
import { DryHopAddition, ID, BrewSession, Recipe, RecipeIngredient } from "../../types";
import "../../styles/BrewSessions.css";

interface DryHopTrackerProps {
  sessionId: ID;
  recipeData?: Partial<Recipe>;
  onSessionUpdate?: (updateData: Partial<BrewSession>) => void;
}

interface RecipeDryHop {
  ingredient: RecipeIngredient;
  plannedDays?: number; // From recipe time field
  addedToFermenter?: boolean;
  additionDate?: string;
  removalDate?: string;
  actualDaysInFermenter?: number | null;
}

const DryHopTracker: React.FC<DryHopTrackerProps> = ({ sessionId, recipeData, onSessionUpdate }) => {
  const [sessionDryHops, setSessionDryHops] = useState<DryHopAddition[]>([]);
  const [recipeDryHops, setRecipeDryHops] = useState<RecipeDryHop[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Extract dry hops from recipe and merge with session data
  const processRecipeDryHops = useCallback((): void => {
    if (!recipeData?.ingredients) {
      setRecipeDryHops([]);
      return;
    }

    // Find all dry hop ingredients from recipe
    const dryHopIngredients = recipeData.ingredients.filter(
      ingredient => ingredient.use === "dry_hop"
    );

    // Create RecipeDryHop objects with tracking information
    const processedDryHops: RecipeDryHop[] = dryHopIngredients.map(ingredient => {
      // Find matching session dry hop addition if it exists
      const matchingSessionHop = sessionDryHops.find(
        sessionHop => sessionHop.hop_name.toLowerCase() === ingredient.name.toLowerCase()
      );

      return {
        ingredient,
        plannedDays: ingredient.time || undefined, // Time field represents planned days in fermenter
        addedToFermenter: !!matchingSessionHop,
        additionDate: matchingSessionHop?.addition_date,
        removalDate: matchingSessionHop?.removal_date,
        actualDaysInFermenter: matchingSessionHop ? calculateDaysInFermenter(matchingSessionHop) : undefined
      };
    });

    setRecipeDryHops(processedDryHops);
  }, [recipeData?.ingredients, sessionDryHops]);

  // Fetch session dry hop additions
  const fetchSessionDryHops = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      
      const response = await Services.brewSession.getDryHopAdditions(sessionId);
      setSessionDryHops(response.data.dry_hop_additions || []);
    } catch (err: any) {
      console.error("Error fetching dry hop additions:", err);
      setError("Failed to load dry hop additions");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Load session data and process recipe data
  useEffect(() => {
    fetchSessionDryHops();
  }, [sessionId, fetchSessionDryHops]);

  // Process recipe dry hops when recipe data or session data changes
  useEffect(() => {
    processRecipeDryHops();
  }, [recipeData, sessionDryHops, processRecipeDryHops]);

  // Handle adding a dry hop to fermenter
  const handleAddToFermenter = async (recipeDryHop: RecipeDryHop): Promise<void> => {
    try {
      setSubmitting(true);
      setError("");

      const submissionData = {
        hop_name: recipeDryHop.ingredient.name,
        hop_type: "Pellet", // Default type, can be enhanced later
        amount: recipeDryHop.ingredient.amount,
        amount_unit: recipeDryHop.ingredient.unit,
        duration_days: recipeDryHop.plannedDays,
        notes: `Added from recipe: ${recipeDryHop.ingredient.name}`,
        phase: "fermentation"
      };

      await Services.brewSession.addDryHopAddition(sessionId, submissionData);
      await fetchSessionDryHops(); // Refresh session data
      
      // Notify parent component of session update
      if (onSessionUpdate) {
        onSessionUpdate({});
      }
      
    } catch (err: any) {
      console.error("Error adding dry hop to fermenter:", err);
      setError(err.response?.data?.error || "Failed to add dry hop to fermenter");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle removing a dry hop from fermenter
  const handleRemoveFromFermenter = async (recipeDryHop: RecipeDryHop): Promise<void> => {
    try {
      setSubmitting(true);
      setError("");

      // Find the matching session dry hop to get its index
      const matchingSessionHopIndex = sessionDryHops.findIndex(
        sessionHop => sessionHop.hop_name.toLowerCase() === recipeDryHop.ingredient.name.toLowerCase()
      );

      if (matchingSessionHopIndex === -1) {
        setError("Could not find dry hop addition to remove");
        return;
      }

      const now = new Date().toISOString();
      await Services.brewSession.updateDryHopAddition(sessionId, matchingSessionHopIndex, {
        removal_date: now
      });
      
      await fetchSessionDryHops(); // Refresh session data
      
      // Notify parent component of session update
      if (onSessionUpdate) {
        onSessionUpdate({});
      }
      
    } catch (err: any) {
      console.error("Error removing dry hop from fermenter:", err);
      setError("Failed to remove dry hop from fermenter");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle deletion of manual dry hop entries (for any non-recipe dry hops)
  const handleDeleteManualDryHop = async (index: number) => {
    if (!window.confirm("Are you sure you want to delete this dry hop addition?")) {
      return;
    }

    try {
      await Services.brewSession.deleteDryHopAddition(sessionId, index);
      await fetchSessionDryHops();
      
      // Notify parent component of session update
      if (onSessionUpdate) {
        onSessionUpdate({});
      }
    } catch (err: any) {
      console.error("Error deleting dry hop:", err);
      setError("Failed to delete dry hop addition");
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate days in fermenter
  const calculateDaysInFermenter = (addition: DryHopAddition): number | null => {
    const addDate = new Date(addition.addition_date);
    const endDate = addition.removal_date ? new Date(addition.removal_date) : new Date();
    const diffTime = endDate.getTime() - addDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };

  if (loading) {
    return <div className="loading-message">Loading dry hop data...</div>;
  }

  return (
    <div className="brew-session-section">
      <div className="fermentation-header">
        <h3 className="section-title">Dry Hop Schedule</h3>
        {recipeDryHops.length === 0 && (
          <div className="dry-hop-info">
            <small>📝 Dry hops are loaded from your recipe</small>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Recipe-based Dry Hop Management */}
      {recipeDryHops.length > 0 ? (
        <div className="fermentation-table-responsive">
          <table className="fermentation-table">
            <thead>
              <tr>
                <th>Hop Name</th>
                <th>Amount</th>
                <th>Planned Duration</th>
                <th>Status</th>
                <th>Actual Timing</th>
                <th>Performance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipeDryHops.map((recipeDryHop, index) => {
                const isInFermenter = recipeDryHop.addedToFermenter && !recipeDryHop.removalDate;
                const isRemoved = recipeDryHop.addedToFermenter && !!recipeDryHop.removalDate;
                const notAdded = !recipeDryHop.addedToFermenter;
                
                let statusClass = "";
                let statusText = "";
                if (notAdded) {
                  statusClass = "pending";
                  statusText = "Ready to Add";
                } else if (isInFermenter) {
                  statusClass = "active";
                  statusText = "In Fermenter";
                } else if (isRemoved) {
                  statusClass = "removed";
                  statusText = "Removed";
                }

                return (
                  <tr key={index}>
                    <td>
                      <strong>{recipeDryHop.ingredient.name}</strong>
                      <div style={{ fontSize: "0.8em", color: "#666" }}>
                        From recipe
                      </div>
                    </td>
                    <td>
                      {recipeDryHop.ingredient.amount} {recipeDryHop.ingredient.unit}
                    </td>
                    <td>
                      {recipeDryHop.plannedDays ? `${recipeDryHop.plannedDays} days` : "Not specified"}
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {statusText}
                      </span>
                    </td>
                    <td>
                      {recipeDryHop.additionDate && (
                        <div>
                          <div style={{ fontSize: "0.8em", color: "#666" }}>
                            Added: {formatDate(recipeDryHop.additionDate)}
                          </div>
                          {recipeDryHop.removalDate && (
                            <div style={{ fontSize: "0.8em", color: "#666" }}>
                              Removed: {formatDate(recipeDryHop.removalDate)}
                            </div>
                          )}
                          {recipeDryHop.actualDaysInFermenter !== null && recipeDryHop.actualDaysInFermenter !== undefined && (
                            <div style={{ fontSize: "0.8em", fontWeight: "bold" }}>
                              Actual: {recipeDryHop.actualDaysInFermenter} days
                            </div>
                          )}
                        </div>
                      )}
                      {!recipeDryHop.additionDate && (
                        <span style={{ color: "#999" }}>Not added yet</span>
                      )}
                    </td>
                    <td>
                      {recipeDryHop.plannedDays && recipeDryHop.actualDaysInFermenter !== null && recipeDryHop.actualDaysInFermenter !== undefined ? (
                        <div>
                          {(() => {
                            const variance = recipeDryHop.actualDaysInFermenter - recipeDryHop.plannedDays;
                            const isOnTarget = Math.abs(variance) <= 1;
                            return (
                              <span style={{ 
                                color: isOnTarget ? "#28a745" : Math.abs(variance) > 2 ? "#dc3545" : "#ffc107",
                                fontSize: "0.8em",
                                fontWeight: "bold"
                              }}>
                                {variance > 0 ? `+${variance}` : variance} days from plan
                              </span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span style={{ color: "#999", fontSize: "0.8em" }}>-</span>
                      )}
                    </td>
                    <td>
                      {notAdded && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleAddToFermenter(recipeDryHop)}
                          disabled={submitting}
                          style={{ marginBottom: "0.25rem" }}
                        >
                          {submitting ? "Adding..." : "Add to Fermenter"}
                        </button>
                      )}
                      {isInFermenter && (
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleRemoveFromFermenter(recipeDryHop)}
                          disabled={submitting}
                        >
                          {submitting ? "Removing..." : "Remove from Fermenter"}
                        </button>
                      )}
                      {isRemoved && (
                        <span style={{ color: "#28a745", fontSize: "0.8em" }}>
                          ✓ Complete
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>🍺 No dry hops found in this recipe.</p>
          <p style={{ fontSize: "0.9em", color: "#666" }}>
            Add dry hops to your recipe (with "Dry Hop" timing) to track them here.
          </p>
        </div>
      )}

      {/* Manual dry hop additions section (for any non-recipe dry hops) */}
      {sessionDryHops.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h4 className="section-title">Manual Additions</h4>
          <div className="fermentation-table-responsive">
            <table className="fermentation-table">
              <thead>
                <tr>
                  <th>Date Added</th>
                  <th>Hop Name</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionDryHops
                  .filter(sessionHop => 
                    !recipeDryHops.some(recipeHop => 
                      recipeHop.ingredient.name.toLowerCase() === sessionHop.hop_name.toLowerCase()
                    )
                  )
                  .map((hop, index) => {
                    const daysInFermenter = calculateDaysInFermenter(hop);
                    const isRemoved = !!hop.removal_date;
                    
                    return (
                      <tr key={index}>
                        <td>{formatDate(hop.addition_date)}</td>
                        <td>{hop.hop_name}</td>
                        <td>{hop.amount} {hop.amount_unit}</td>
                        <td>
                          <span className={`status-badge ${isRemoved ? "removed" : "active"}`}>
                            {isRemoved ? "Removed" : "Active"}
                          </span>
                          {daysInFermenter !== null && (
                            <div style={{ fontSize: "0.8em", color: "#666" }}>
                              {daysInFermenter} days in fermenter
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            className="fermentation-delete-button"
                            onClick={() => handleDeleteManualDryHop(index)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DryHopTracker;