import React from "react";
import { Link } from "react-router";
import "./Navigation.css";
import logo from "../images/mugOfBeer512.png";

function Navigation({ user, onLogout }) {
  return (
    <header className="header">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="logo">
          <img src={logo} alt="Brewtracker Logo" />
          <h1 className="text-2xl font-bold text-amber-100">Brewtracker</h1>
        </Link>

        <nav className="nav">
          {user ? (
            <>
              <Link to="/recipes" className="nav-link">
                Recipes
              </Link>
              <Link to="/brew-sessions" className="nav-link">
                Brew Sessions
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
}

export default Navigation;
