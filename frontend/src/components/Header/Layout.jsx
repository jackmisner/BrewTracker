// src/components/Layout.jsx
import React from "react";
import Navigation from "../Navigation";

const Layout = ({ user, onLogout, children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navigation user={user} onLogout={onLogout} />
      <main className="flex-grow container mx-auto p-4">{children}</main>
    </div>
  );
};

export default Layout;
