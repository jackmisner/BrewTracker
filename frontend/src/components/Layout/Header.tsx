/**
 * Header component for the Brewtracker application.
 *
 * Renders the main navigation bar, including logo, navigation links, and user actions.
 * The layout and available links change depending on whether a user is logged in.
 *
 * @param user - The currently authenticated user, or null if not logged in.
 * @param onLogout - Callback function to be called when the user clicks the logout button.
 *
 * @remarks
 * - Displays navigation links for recipes, brew sessions, and management tools when a user is logged in.
 * - Shows login and registration links when no user is authenticated.
 * - Uses the application's logo and styles defined in `Header.css`.
 */
import React from "react";
import { Link } from "react-router";
import { User } from "@/types";
import "@/styles/Header.css";
import logo from "@/images/mugOfBeer512.png";

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="header">
      <div className="header-container">
        {user ? (
          <>
            {/* Left Group: Logo and Primary Navigation */}
            <div className="nav-group nav-group-left">
              <Link to="/" className="logo">
                <img src={logo} alt="Brewtracker Logo" />
                <h1 className="logo-title">Brewtracker</h1>
              </Link>
              <Link to="/recipes" className="nav-link">
                Recipes
              </Link>
              <Link to="/recipes/public" className="nav-link">
                Public Recipes
              </Link>
              <Link to="/brew-sessions" className="nav-link">
                Brew Sessions
              </Link>
            </div>

            {/* Center Group: Management Tools */}
            <div className="nav-group nav-group-center">
              <Link to="/ingredients/manage" className="nav-link">
                Manage Ingredients
              </Link>
              <Link to="/attenuation-analytics" className="nav-link">
                Yeast Attenuation Analytics
              </Link>
            </div>

            {/* Right Group: User Actions and Greeting */}
            <div className="nav-group nav-group-right">
              <span className="user-greeting">Hello, {user.username}</span>
              <Link to="/settings" className="nav-link">
                Settings
              </Link>
              <button onClick={onLogout} className="nav-link">
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Left Group: Logo only when not logged in */}
            <div className="nav-group nav-group-left">
              <Link to="/" className="logo">
                <img src={logo} alt="Brewtracker Logo" />
                <h1 className="logo-title">Brewtracker</h1>
              </Link>
            </div>

            {/* Center Group: Empty when not logged in */}
            <div className="nav-group nav-group-center"></div>

            {/* Right Group: Auth Links */}
            <div className="nav-group nav-group-right">
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="nav-link">
                Register
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
