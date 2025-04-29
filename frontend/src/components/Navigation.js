import React from "react";
import { Link } from "react-router";

function Navigation({ user, onLogout }) {
  return (
    <nav className="bg-amber-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">
          Homebrew Tracker
        </Link>

        <div className="flex space-x-4">
          {user ? (
            <>
              <Link to="/recipes" className="hover:text-amber-200">
                Recipes
              </Link>
              <Link to="/brew-sessions" className="hover:text-amber-200">
                Brew Sessions
              </Link>
              <button onClick={onLogout} className="hover:text-amber-200">
                Logout
              </button>
              <span className="ml-4">Hello, {user.username}</span>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-amber-200">
                Login
              </Link>
              <Link to="/register" className="hover:text-amber-200">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
