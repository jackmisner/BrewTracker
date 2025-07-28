import React from "react";

const Help: React.FC = () => {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">User Guide</h1>
        <p className="page-subtitle">
          Learn how to make the most of BrewTracker's features.
        </p>
      </div>
      
      <div className="content-container">
        {/* Getting Started */}
        <div className="card">
          <div className="card-title">Getting Started</div>
          <div className="content-section">
            <h3>Creating Your First Recipe</h3>
            <ol>
              <li>Navigate to <strong>Recipes</strong> in the main menu</li>
              <li>Click <strong>+ New Recipe</strong></li>
              <li>Fill in basic recipe information (name, style, batch size)</li>
              <li>Add ingredients using the ingredient selector</li>
              <li>BrewTracker will automatically calculate brewing metrics</li>
              <li>Save your recipe to access it later</li>
            </ol>
          </div>
        </div>

        {/* Recipe Management */}
        <div className="card">
          <div className="card-title">Recipe Management</div>
          <div className="content-section">
            <h3>Recipe Actions</h3>
            <ul>
              <li><strong>View:</strong> See complete recipe details and calculations</li>
              <li><strong>Edit:</strong> Modify ingredients and recipe information</li>
              <li><strong>Clone:</strong> Create a copy to experiment with variations</li>
              <li><strong>Brew:</strong> Start a new brew session from this recipe</li>
            </ul>
            
            <h3>Recipe Versioning</h3>
            <p>
              When you clone a recipe, BrewTracker creates a linked version. This helps 
              you track recipe evolution and compare different iterations.
            </p>
            
            <h3>Public vs Private Recipes</h3>
            <p>
              You can share recipes with the community by making them public, or keep 
              them private for personal use. Public recipes can be cloned by other users.
            </p>
          </div>
        </div>

        {/* Brewing Calculations */}
        <div className="card">
          <div className="card-title">Brewing Calculations</div>
          <div className="content-section">
            <h3>Automatic Metrics</h3>
            <p>BrewTracker automatically calculates key brewing metrics:</p>
            <ul>
              <li><strong>OG (Original Gravity):</strong> Starting sugar content</li>
              <li><strong>FG (Final Gravity):</strong> Ending sugar content after fermentation</li>
              <li><strong>ABV (Alcohol By Volume):</strong> Alcohol percentage</li>
              <li><strong>IBU (International Bitterness Units):</strong> Hop bitterness</li>
              <li><strong>SRM (Standard Reference Method):</strong> Beer color</li>
            </ul>
            
            <h3>Unit Conversion</h3>
            <p>
              Toggle between metric and imperial units in your user settings. 
              BrewTracker handles all conversions automatically.
            </p>
          </div>
        </div>

        {/* Brew Sessions */}
        <div className="card">
          <div className="card-title">Brew Sessions</div>
          <div className="content-section">
            <h3>Tracking Your Brews</h3>
            <p>
              Brew sessions help you track the journey from grain to glass:
            </p>
            <ul>
              <li>Record actual gravity readings vs. estimated values</li>
              <li>Track fermentation progress and timing</li>
              <li>Add tasting notes and batch ratings</li>
              <li>Monitor yeast performance over time</li>
            </ul>
            
            <h3>Session Status</h3>
            <ul>
              <li><strong>Planned:</strong> Ready to brew</li>
              <li><strong>In Progress:</strong> Currently brewing</li>
              <li><strong>Fermenting:</strong> Primary fermentation</li>
              <li><strong>Conditioning:</strong> Secondary/bottle conditioning</li>
              <li><strong>Completed:</strong> Ready to drink</li>
            </ul>
          </div>
        </div>

        {/* AI Features */}
        <div className="card">
          <div className="card-title">AI Recipe Optimization</div>
          <div className="content-section">
            <h3>Smart Recipe Suggestions</h3>
            <p>
              BrewTracker's AI system can analyze your recipes and suggest improvements 
              to meet specific beer style guidelines:
            </p>
            <ul>
              <li>Automatic style compliance checking</li>
              <li>Ingredient substitution suggestions</li>
              <li>Hop timing optimization for IBU targets</li>
              <li>Malt bill adjustments for color and gravity</li>
            </ul>
            
            <h3>Using AI Suggestions</h3>
            <ol>
              <li>Open any recipe in the recipe builder</li>
              <li>Select a beer style from the dropdown</li>
              <li>Click the AI suggestions panel</li>
              <li>Review and apply suggested changes</li>
            </ol>
          </div>
        </div>

        {/* Advanced Features */}
        <div className="card">
          <div className="card-title">Advanced Features</div>
          <div className="content-section">
            <h3>BeerXML Import/Export</h3>
            <p>
              Import recipes from other brewing software or export your BrewTracker 
              recipes in the standard BeerXML format.
            </p>
            
            <h3>Yeast Attenuation Analytics</h3>
            <p>
              Track real-world yeast performance data to improve fermentation predictions 
              and recipe planning.
            </p>
            
            <h3>Ingredient Management</h3>
            <p>
              Browse and search through a comprehensive database of brewing ingredients, 
              including detailed specifications for malts, hops, and yeasts.
            </p>
          </div>
        </div>

        {/* Tips and Best Practices */}
        <div className="card">
          <div className="card-title">Tips & Best Practices</div>
          <div className="content-section">
            <h3>Recipe Organization</h3>
            <ul>
              <li>Use descriptive names for your recipes</li>
              <li>Include tasting notes and brewing observations</li>
              <li>Clone recipes before making major changes</li>
              <li>Rate your finished beers to track favorites</li>
            </ul>
            
            <h3>Accurate Brewing</h3>
            <ul>
              <li>Always record actual gravity readings in brew sessions</li>
              <li>Update ingredient amounts based on what you actually used</li>
              <li>Track water chemistry and environmental conditions</li>
              <li>Note any deviations from the planned process</li>
            </ul>
          </div>
        </div>

        {/* Support */}
        <div className="card">
          <div className="card-title">Need More Help?</div>
          <div className="content-section">
            <p>
              If you can't find what you're looking for in this guide:
            </p>
            <ul>
              <li>Check the <a href="/faq">FAQ</a> for common questions</li>
              <li>Report bugs using our <a href="/report-bug">Bug Report</a> form</li>
              <li>Request features using our <a href="/feature-request">Feature Request</a> form</li>
              <li>Contact us through the <a href="/about">About</a> page</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;