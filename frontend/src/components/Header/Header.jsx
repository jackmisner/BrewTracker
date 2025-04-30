import { useState, useEffect } from "react";
import { Link } from "react-router";
import "./Header.css";

const Header = () => {
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    // Initial check
    setToken(localStorage.getItem("token"));

    // Create a function to handle storage changes
    const handleStorageChange = () => {
      setToken(localStorage.getItem("token"));
    };

    // Add event listener
    window.addEventListener("storage", handleStorageChange);

    // Create a custom event listener for login/logout actions
    const handleAuthChange = () => {
      setToken(localStorage.getItem("token"));
    };

    window.addEventListener("authChange", handleAuthChange);

    // Cleanup
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("authChange", handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event("authChange"));
  };

  return (
    <>
      <header className="header">
        <Link to="/" className="logo">
          <img src="/BotaniClashLogo.svg" alt="BotaniClash Logo" />
        </Link>
        <nav className="nav">
          {!token && (
            <Link to="/signup" className="nav-link">
              Signup
            </Link>
          )}
          {!token && (
            <Link to="/login" className="nav-link">
              Login
            </Link>
          )}

          {token && (
            <Link to="/" onClick={handleLogout} className="nav-link">
              Logout
            </Link>
          )}
        </nav>
      </header>
      <div className="content"></div>
    </>
  );
};

export default Header;
