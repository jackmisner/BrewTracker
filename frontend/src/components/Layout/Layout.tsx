/**
 * Layout component that provides a consistent page structure with a header, main content area, and footer.
 *
 * @param user - The current authenticated user, or null if not logged in.
 * @param onLogout - Callback function to handle user logout.
 * @param children - The main content to be rendered within the layout.
 *
 * @remarks
 * This component wraps its children with a header and footer, and manages layout styling using Tailwind CSS classes.
 */
import React from "react";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import { User } from "@/types";

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header user={user} onLogout={onLogout} />
      {user && <EmailVerificationBanner user={user} />}
      <main className="flex-grow container mx-auto p-4">{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
