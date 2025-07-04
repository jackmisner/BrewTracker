import React from "react";
import { Link } from "react-router";
import { User } from "../../types";
import "../../styles/Header.css";
import logo from "../../images/mugOfBeer512.png";

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <img src={logo} alt="Brewtracker Logo" />
          <h1 className="logo-title">Brewtracker</h1>
        </Link>

        <nav className="nav">
          {user ? (
            <>
              <Link to="/recipes" className="nav-link">
                Recipes
              </Link>
              <Link to="/recipes/public" className="nav-link">
                Public Recipes
              </Link>
              <Link to="/ingredients/manage" className="nav-link">
                Manage Ingredients
              </Link>
              <Link to="/attenuation-analytics" className="nav-link">
                Yeast Attenuation Analytics
              </Link>
              <Link to="/brew-sessions" className="nav-link">
                Brew Sessions
              </Link>
              <Link to="/settings" className="nav-link">
                Settings
              </Link>
              <button onClick={onLogout} className="nav-link">
                Logout
              </button>
              <span className="user-greeting">Hello, {user.username}</span>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="nav-link">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;