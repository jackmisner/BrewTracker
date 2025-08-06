import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import Footer from "../../src/components/Layout/Footer";

// Mock the version constant
jest.mock("@/constants/version", () => ({
  APP_VERSION: "1.2.3",
}));

// Helper to render Footer with router context
const renderFooter = () => {
  return render(
    <BrowserRouter>
      <Footer />
    </BrowserRouter>
  );
};

describe("Footer", () => {
  beforeEach(() => {
    // Mock Date to ensure consistent year testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Component Structure", () => {
    test("renders footer element with proper structure", () => {
      renderFooter();
      
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass("footer");
    });

    test("renders footer container and content", () => {
      renderFooter();
      
      const container = document.querySelector(".footer-container");
      const content = document.querySelector(".footer-content");
      
      expect(container).toBeInTheDocument();
      expect(content).toBeInTheDocument();
    });

    test("renders three footer columns", () => {
      renderFooter();
      
      const columns = document.querySelectorAll(".footer-column");
      expect(columns).toHaveLength(3);
    });

    test("renders footer bottom section", () => {
      renderFooter();
      
      const footerBottom = document.querySelector(".footer-bottom");
      expect(footerBottom).toBeInTheDocument();
    });
  });

  describe("Column 1: Project & Development", () => {
    test("renders BrewTracker column header", () => {
      renderFooter();
      
      const header = screen.getByText("BrewTracker");
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("footer-column-title");
    });

    test("renders GitHub repository link", () => {
      renderFooter();
      
      const githubLink = screen.getByText("GitHub Repository");
      expect(githubLink).toBeInTheDocument();
      expect(githubLink.closest("a")).toHaveAttribute(
        "href",
        "https://github.com/jackmisner/BrewTracker"
      );
      expect(githubLink.closest("a")).toHaveAttribute("target", "_blank");
      expect(githubLink.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
      expect(githubLink.closest("a")).toHaveClass("footer-link", "external-link");
    });

    test("renders GitHub external link icon", () => {
      renderFooter();
      
      const externalIcon = document.querySelector(".external-icon");
      expect(externalIcon).toBeInTheDocument();
      expect(externalIcon).toHaveTextContent("↗");
    });

    test("renders Report Bug/Issue internal link", () => {
      renderFooter();
      
      const reportBugLink = screen.getByText("Report Bug/Issue");
      expect(reportBugLink).toBeInTheDocument();
      expect(reportBugLink.closest("a")).toHaveAttribute("href", "/report-bug");
      expect(reportBugLink).toHaveClass("footer-link");
    });

    test("renders Feature Requests internal link", () => {
      renderFooter();
      
      const featureRequestLink = screen.getByText("Feature Requests");
      expect(featureRequestLink).toBeInTheDocument();
      expect(featureRequestLink.closest("a")).toHaveAttribute("href", "/feature-request");
      expect(featureRequestLink).toHaveClass("footer-link");
    });

    test("displays application version from version constant", () => {
      renderFooter();
      
      const versionText = screen.getByText("Version 1.2.3");
      expect(versionText).toBeInTheDocument();
      expect(versionText).toHaveClass("footer-version");
    });
  });

  describe("Column 2: Help & Resources", () => {
    test("renders Help & Resources column header", () => {
      renderFooter();
      
      const header = screen.getByText("Help & Resources");
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("footer-column-title");
    });

    test("renders User Guide internal link", () => {
      renderFooter();
      
      const userGuideLink = screen.getByText("User Guide");
      expect(userGuideLink).toBeInTheDocument();
      expect(userGuideLink.closest("a")).toHaveAttribute("href", "/help");
      expect(userGuideLink).toHaveClass("footer-link");
    });

    test("renders FAQ internal link", () => {
      renderFooter();
      
      const faqLink = screen.getByText("FAQ");
      expect(faqLink).toBeInTheDocument();
      expect(faqLink.closest("a")).toHaveAttribute("href", "/faq");
      expect(faqLink).toHaveClass("footer-link");
    });

    test("renders BJCP Style Guidelines external link", () => {
      renderFooter();
      
      const bjcpLink = screen.getByText("BJCP Style Guidelines");
      expect(bjcpLink).toBeInTheDocument();
      expect(bjcpLink.closest("a")).toHaveAttribute("href", "https://www.bjcp.org");
      expect(bjcpLink.closest("a")).toHaveAttribute("target", "_blank");
      expect(bjcpLink.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
      expect(bjcpLink.closest("a")).toHaveClass("footer-link", "external-link");
    });

    test("renders Brewing Resources external link", () => {
      renderFooter();
      
      const brewingResourcesLink = screen.getByText("Brewing Resources");
      expect(brewingResourcesLink).toBeInTheDocument();
      expect(brewingResourcesLink.closest("a")).toHaveAttribute("href", "https://www.brewersfriend.com");
      expect(brewingResourcesLink.closest("a")).toHaveAttribute("target", "_blank");
      expect(brewingResourcesLink.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
      expect(brewingResourcesLink.closest("a")).toHaveClass("footer-link", "external-link");
    });
  });

  describe("Column 3: About & Legal", () => {
    test("renders About & Legal column header", () => {
      renderFooter();
      
      const header = screen.getByText("About & Legal");
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("footer-column-title");
    });

    test("renders About Me internal link", () => {
      renderFooter();
      
      const aboutLink = screen.getByText("About Me");
      expect(aboutLink).toBeInTheDocument();
      expect(aboutLink.closest("a")).toHaveAttribute("href", "/about");
      expect(aboutLink).toHaveClass("footer-link");
    });

    test("renders Privacy Policy internal link", () => {
      renderFooter();
      
      const privacyLink = screen.getByText("Privacy Policy");
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink.closest("a")).toHaveAttribute("href", "/privacy");
      expect(privacyLink).toHaveClass("footer-link");
    });

    test("renders Terms of Service internal link", () => {
      renderFooter();
      
      const termsLink = screen.getByText("Terms of Service");
      expect(termsLink).toBeInTheDocument();
      expect(termsLink.closest("a")).toHaveAttribute("href", "/terms");
      expect(termsLink).toHaveClass("footer-link");
    });

    test("renders GPL v3 License external link", () => {
      renderFooter();
      
      const licenseLink = screen.getByText("GPL v3 License");
      expect(licenseLink).toBeInTheDocument();
      expect(licenseLink.closest("a")).toHaveAttribute("href", "https://www.gnu.org/licenses/gpl-3.0.html");
      expect(licenseLink.closest("a")).toHaveAttribute("target", "_blank");
      expect(licenseLink.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
      expect(licenseLink.closest("a")).toHaveClass("footer-link", "external-link");
    });
  });

  describe("Footer Bottom Section", () => {
    test("renders copyright notice with current year", () => {
      renderFooter();
      
      const copyrightText = screen.getByText("© 2024 BrewTracker. Built with ❤️ for the brewing community.");
      expect(copyrightText).toBeInTheDocument();
      expect(copyrightText).toHaveClass("footer-copyright");
    });

    test("dynamically updates year based on current date", () => {
      // Test with different year
      jest.setSystemTime(new Date("2025-06-15"));
      
      renderFooter();
      
      const copyrightText = screen.getByText("© 2025 BrewTracker. Built with ❤️ for the brewing community.");
      expect(copyrightText).toBeInTheDocument();
    });
  });

  describe("External Link Properties", () => {
    test("all external links have proper security attributes", () => {
      renderFooter();
      
      const externalLinks = document.querySelectorAll(".external-link");
      
      externalLinks.forEach(link => {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      });
    });

    test("all external links have external icon", () => {
      renderFooter();
      
      const externalLinks = document.querySelectorAll(".external-link");
      
      externalLinks.forEach(link => {
        const icon = link.querySelector(".external-icon");
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveTextContent("↗");
      });
    });
  });

  describe("CSS Classes", () => {
    test("applies correct CSS classes to footer elements", () => {
      renderFooter();
      
      // Main elements
      expect(document.querySelector(".footer")).toBeInTheDocument();
      expect(document.querySelector(".footer-container")).toBeInTheDocument();
      expect(document.querySelector(".footer-content")).toBeInTheDocument();
      expect(document.querySelector(".footer-bottom")).toBeInTheDocument();
      
      // Column elements
      const columns = document.querySelectorAll(".footer-column");
      expect(columns).toHaveLength(3);
      
      const columnTitles = document.querySelectorAll(".footer-column-title");
      expect(columnTitles).toHaveLength(3);
      
      const linkLists = document.querySelectorAll(".footer-links");
      expect(linkLists).toHaveLength(3);
      
      // Link elements
      const footerLinks = document.querySelectorAll(".footer-link");
      expect(footerLinks.length).toBeGreaterThan(0);
      
      // Version and copyright
      expect(document.querySelector(".footer-version")).toBeInTheDocument();
      expect(document.querySelector(".footer-copyright")).toBeInTheDocument();
    });
  });

  describe("Navigation Links", () => {
    test("internal navigation links use Link component", () => {
      renderFooter();
      
      const internalPaths = [
        "/report-bug",
        "/feature-request", 
        "/help",
        "/faq",
        "/about",
        "/privacy",
        "/terms"
      ];
      
      internalPaths.forEach(path => {
        const link = document.querySelector(`a[href="${path}"]`);
        expect(link).toBeInTheDocument();
        expect(link).not.toHaveAttribute("target");
        expect(link).not.toHaveClass("external-link");
      });
    });

    test("external links use anchor tags", () => {
      renderFooter();
      
      const externalUrls = [
        "https://github.com/jackmisner/BrewTracker",
        "https://www.bjcp.org",
        "https://www.brewersfriend.com",
        "https://www.gnu.org/licenses/gpl-3.0.html"
      ];
      
      externalUrls.forEach(url => {
        const link = document.querySelector(`a[href="${url}"]`);
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveClass("external-link");
      });
    });
  });

  describe("Accessibility", () => {
    test("footer has proper semantic role", () => {
      renderFooter();
      
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeInTheDocument();
    });

    test("all links are accessible", () => {
      renderFooter();
      
      const links = document.querySelectorAll("a");
      
      links.forEach(link => {
        expect(link).toBeVisible();
        expect(link.textContent?.trim()).toBeTruthy();
      });
    });

    test("headings use proper hierarchy", () => {
      renderFooter();
      
      const headings = document.querySelectorAll("h3");
      expect(headings).toHaveLength(3);
      
      headings.forEach(heading => {
        expect(heading).toHaveClass("footer-column-title");
        expect(heading.textContent?.trim()).toBeTruthy();
      });
    });
  });

  describe("Content Validation", () => {
    test("displays all expected section titles", () => {
      renderFooter();
      
      expect(screen.getByText("BrewTracker")).toBeInTheDocument();
      expect(screen.getByText("Help & Resources")).toBeInTheDocument();
      expect(screen.getByText("About & Legal")).toBeInTheDocument();
    });

    test("displays all expected navigation links", () => {
      renderFooter();
      
      const expectedLinks = [
        "GitHub Repository",
        "Report Bug/Issue",
        "Feature Requests",
        "User Guide",
        "FAQ", 
        "BJCP Style Guidelines",
        "Brewing Resources",
        "About Me",
        "Privacy Policy",
        "Terms of Service",
        "GPL v3 License"
      ];
      
      expectedLinks.forEach(linkText => {
        expect(screen.getByText(linkText)).toBeInTheDocument();
      });
    });

    test("version text includes version number", () => {
      renderFooter();
      
      const versionElement = document.querySelector(".footer-version");
      expect(versionElement).toHaveTextContent("Version 1.2.3");
    });
  });
});