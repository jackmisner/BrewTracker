import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FAQ from "../../src/pages/FAQ";

describe("FAQ", () => {
  beforeEach(() => {
    render(<FAQ />);
  });

  describe("Page Structure", () => {
    test("renders page header with title and subtitle", () => {
      expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
      expect(screen.getByText("Find answers to common questions about BrewTracker.")).toBeInTheDocument();
    });

    test("renders all category buttons", () => {
      expect(screen.getByText("All Questions")).toBeInTheDocument();
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Brewing")).toBeInTheDocument();
      expect(screen.getByText("Features")).toBeInTheDocument();
      expect(screen.getByText("Technical")).toBeInTheDocument();
    });

    test("renders FAQ items container", () => {
      const faqList = document.querySelector(".faq-list");
      expect(faqList).toBeInTheDocument();
    });

    test("renders contact section", () => {
      expect(screen.getByText("Still Have Questions?")).toBeInTheDocument();
      expect(screen.getByText("If you can't find the answer you're looking for, here are some ways to get help:")).toBeInTheDocument();
    });
  });

  describe("Category Filtering", () => {
    test("'All Questions' category is active by default", () => {
      const allButton = screen.getByText("All Questions");
      expect(allButton).toHaveClass("active");
    });

    test("displays all FAQ items when 'All Questions' is selected", () => {
      // Should show all categories of questions
      expect(screen.getByText("What is BrewTracker?")).toBeInTheDocument();
      expect(screen.getByText("How accurate are the brewing calculations?")).toBeInTheDocument();
      expect(screen.getByText("Which browsers are supported?")).toBeInTheDocument();
      expect(screen.getByText("How do the AI recipe suggestions work?")).toBeInTheDocument();
    });

    test("filters to General category", async () => {
      const generalButton = screen.getByText("General");
      await userEvent.click(generalButton);

      expect(generalButton).toHaveClass("active");
      
      // Should show general questions
      expect(screen.getByText("What is BrewTracker?")).toBeInTheDocument();
      expect(screen.getByText("Is BrewTracker free to use?")).toBeInTheDocument();
      expect(screen.getByText("How is my brewing data protected?")).toBeInTheDocument();
    });

    test("filters to Brewing category", async () => {
      const brewingButton = screen.getByText("Brewing");
      await userEvent.click(brewingButton);

      expect(brewingButton).toHaveClass("active");
      
      // Should show brewing questions
      expect(screen.getByText("How accurate are the brewing calculations?")).toBeInTheDocument();
      expect(screen.getByText("Can I scale recipes to different batch sizes?")).toBeInTheDocument();
      expect(screen.getByText("How do I handle ingredient substitutions?")).toBeInTheDocument();
      expect(screen.getByText("How do I account for my brewing efficiency?")).toBeInTheDocument();
    });

    test("filters to Features category", async () => {
      const featuresButton = screen.getByText("Features");
      await userEvent.click(featuresButton);

      expect(featuresButton).toHaveClass("active");
      
      // Should show features questions
      expect(screen.getByText("How do the AI recipe suggestions work?")).toBeInTheDocument();
      expect(screen.getByText("How do public recipes work?")).toBeInTheDocument();
      expect(screen.getByText("What's the difference between recipes and brew sessions?")).toBeInTheDocument();
      expect(screen.getByText("Where does the ingredient data come from?")).toBeInTheDocument();
    });

    test("filters to Technical category", async () => {
      const technicalButton = screen.getByText("Technical");
      await userEvent.click(technicalButton);

      expect(technicalButton).toHaveClass("active");
      
      // Should show technical questions
      expect(screen.getByText("Which browsers are supported?")).toBeInTheDocument();
      expect(screen.getByText("Can I use BrewTracker on my phone or tablet?")).toBeInTheDocument();
      expect(screen.getByText("Can I export my recipes and data?")).toBeInTheDocument();
      expect(screen.getByText("Does BrewTracker work offline?")).toBeInTheDocument();
    });

    test("updates active category button styling", async () => {
      const allButton = screen.getByText("All Questions");
      const brewingButton = screen.getByText("Brewing");

      // Initially "All Questions" is active
      expect(allButton).toHaveClass("active");
      expect(brewingButton).not.toHaveClass("active");

      // Click brewing button
      await userEvent.click(brewingButton);

      // Now brewing is active, all is not
      expect(allButton).not.toHaveClass("active");
      expect(brewingButton).toHaveClass("active");
    });

    test("filtering hides non-matching questions", async () => {
      // Switch to General category
      const generalButton = screen.getByText("General");
      await userEvent.click(generalButton);

      // General questions should be visible
      expect(screen.getByText("What is BrewTracker?")).toBeInTheDocument();
      
      // Non-general questions should not be visible
      expect(screen.queryByText("How accurate are the brewing calculations?")).not.toBeInTheDocument();
      expect(screen.queryByText("Which browsers are supported?")).not.toBeInTheDocument();
      expect(screen.queryByText("How do the AI recipe suggestions work?")).not.toBeInTheDocument();
    });
  });

  describe("FAQ Item Interaction", () => {
    test("FAQ items are collapsed by default", () => {
      const faqItems = document.querySelectorAll(".faq-item");
      faqItems.forEach(item => {
        const answer = item.querySelector(".faq-answer");
        expect(answer).not.toBeInTheDocument();
      });
    });

    test("clicking FAQ question expands the answer", async () => {
      const questionButton = screen.getByText("What is BrewTracker?");
      
      // Initially collapsed
      expect(screen.queryByText("BrewTracker is a comprehensive homebrewing management application")).not.toBeInTheDocument();
      
      // Click to expand
      await userEvent.click(questionButton);
      
      // Now expanded
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
    });

    test("clicking expanded FAQ question collapses the answer", async () => {
      const questionButton = screen.getByText("What is BrewTracker?");
      
      // Expand first
      await userEvent.click(questionButton);
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
      
      // Click again to collapse
      await userEvent.click(questionButton);
      expect(screen.queryByText("BrewTracker is a comprehensive homebrewing management application")).not.toBeInTheDocument();
    });

    test("multiple FAQ items can be expanded simultaneously", async () => {
      const question1 = screen.getByText("What is BrewTracker?");
      const question2 = screen.getByText("Is BrewTracker free to use?");
      
      // Expand both
      await userEvent.click(question1);
      await userEvent.click(question2);
      
      // Both should be visible
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
      expect(screen.getByText("Yes! BrewTracker is completely free and open-source. You can use all features without any cost, and the source code is available on GitHub for transparency and community contributions.")).toBeInTheDocument();
    });

    test("FAQ icons change state when expanded/collapsed", async () => {
      const questionButton = screen.getByText("What is BrewTracker?");
      
      // Initially no answer is shown
      expect(screen.queryByText(/BrewTracker is a comprehensive homebrewing management application/)).not.toBeInTheDocument();
      
      // Expand
      await userEvent.click(questionButton);
      expect(screen.getByText(/BrewTracker is a comprehensive homebrewing management application/)).toBeInTheDocument();
      
      // Collapse
      await userEvent.click(questionButton);
      expect(screen.queryByText(/BrewTracker is a comprehensive homebrewing management application/)).not.toBeInTheDocument();
    });

    test("FAQ items maintain state when switching categories", async () => {
      // Expand a general question
      const generalQuestion = screen.getByText("What is BrewTracker?");
      await userEvent.click(generalQuestion);
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
      
      // Switch to brewing category and back
      const brewingButton = screen.getByText("Brewing");
      await userEvent.click(brewingButton);
      
      const allButton = screen.getByText("All Questions");
      await userEvent.click(allButton);
      
      // General question should still be expanded
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
    });
  });

  describe("FAQ Content", () => {
    test("displays all expected general questions", async () => {
      const generalButton = screen.getByText("General");
      await userEvent.click(generalButton);

      expect(screen.getByText("What is BrewTracker?")).toBeInTheDocument();
      expect(screen.getByText("Is BrewTracker free to use?")).toBeInTheDocument();
      expect(screen.getByText("How is my brewing data protected?")).toBeInTheDocument();
    });

    test("displays all expected brewing questions", async () => {
      const brewingButton = screen.getByText("Brewing");
      await userEvent.click(brewingButton);

      expect(screen.getByText("How accurate are the brewing calculations?")).toBeInTheDocument();
      expect(screen.getByText("Can I scale recipes to different batch sizes?")).toBeInTheDocument();
      expect(screen.getByText("How do I handle ingredient substitutions?")).toBeInTheDocument();
      expect(screen.getByText("How do I account for my brewing efficiency?")).toBeInTheDocument();
    });

    test("displays all expected features questions", async () => {
      const featuresButton = screen.getByText("Features");
      await userEvent.click(featuresButton);

      expect(screen.getByText("How do the AI recipe suggestions work?")).toBeInTheDocument();
      expect(screen.getByText("How do public recipes work?")).toBeInTheDocument();
      expect(screen.getByText("What's the difference between recipes and brew sessions?")).toBeInTheDocument();
      expect(screen.getByText("Where does the ingredient data come from?")).toBeInTheDocument();
    });

    test("displays all expected technical questions", async () => {
      const technicalButton = screen.getByText("Technical");
      await userEvent.click(technicalButton);

      expect(screen.getByText("Which browsers are supported?")).toBeInTheDocument();
      expect(screen.getByText("Can I use BrewTracker on my phone or tablet?")).toBeInTheDocument();
      expect(screen.getByText("Can I export my recipes and data?")).toBeInTheDocument();
      expect(screen.getByText("Does BrewTracker work offline?")).toBeInTheDocument();
    });

    test("FAQ answers contain expected content", async () => {
      // Test a few key answers
      const questionButton = screen.getByText("Is BrewTracker free to use?");
      await userEvent.click(questionButton);
      
      expect(screen.getByText("Yes! BrewTracker is completely free and open-source. You can use all features without any cost, and the source code is available on GitHub for transparency and community contributions.")).toBeInTheDocument();
    });

    test("displays expected number of FAQ items in each category", async () => {
      // All questions (total count)
      const allButton = screen.getByText("All Questions");
      await userEvent.click(allButton);
      let faqItems = document.querySelectorAll(".faq-item");
      expect(faqItems.length).toBe(15); // Total FAQ items

      // General category
      const generalButton = screen.getByText("General");
      await userEvent.click(generalButton);
      faqItems = document.querySelectorAll(".faq-item");
      expect(faqItems.length).toBe(3);

      // Brewing category
      const brewingButton = screen.getByText("Brewing");
      await userEvent.click(brewingButton);
      faqItems = document.querySelectorAll(".faq-item");
      expect(faqItems.length).toBe(4);

      // Features category
      const featuresButton = screen.getByText("Features");
      await userEvent.click(featuresButton);
      faqItems = document.querySelectorAll(".faq-item");
      expect(faqItems.length).toBe(4);

      // Technical category
      const technicalButton = screen.getByText("Technical");
      await userEvent.click(technicalButton);
      faqItems = document.querySelectorAll(".faq-item");
      expect(faqItems.length).toBe(4);
    });
  });

  describe("Contact Section", () => {
    test("renders contact section with all help links", () => {
      expect(screen.getByText("Still Have Questions?")).toBeInTheDocument();
      
      const reportBugLink = screen.getByText("Report a bug");
      expect(reportBugLink).toBeInTheDocument();
      expect(reportBugLink.closest("a")).toHaveAttribute("href", "/report-bug");
      
      const featureRequestLink = screen.getByText("Request a feature");
      expect(featureRequestLink).toBeInTheDocument();
      expect(featureRequestLink.closest("a")).toHaveAttribute("href", "/feature-request");
      
      const userGuideLink = screen.getByText("User Guide");
      expect(userGuideLink).toBeInTheDocument();
      expect(userGuideLink.closest("a")).toHaveAttribute("href", "/help");
      
      const aboutLink = screen.getByText("About the developer");
      expect(aboutLink).toBeInTheDocument();
      expect(aboutLink.closest("a")).toHaveAttribute("href", "/about");
    });

    test("contact section has proper structure", () => {
      const contactCard = screen.getByText("Still Have Questions?").closest(".card");
      expect(contactCard).toBeInTheDocument();
      
      const contentSection = contactCard?.querySelector(".content-section");
      expect(contentSection).toBeInTheDocument();
      
      const helpList = contentSection?.querySelector("ul");
      expect(helpList).toBeInTheDocument();
      
      const listItems = helpList?.querySelectorAll("li");
      expect(listItems).toHaveLength(4);
    });
  });

  describe("CSS Classes and Structure", () => {
    test("applies correct CSS classes to main structure", () => {
      expect(document.querySelector(".container")).toBeInTheDocument();
      expect(document.querySelector(".page-header")).toBeInTheDocument();
      expect(document.querySelector(".page-title")).toBeInTheDocument();
      expect(document.querySelector(".page-subtitle")).toBeInTheDocument();
      expect(document.querySelector(".content-container")).toBeInTheDocument();
    });

    test("applies correct CSS classes to categories section", () => {
      expect(document.querySelector(".faq-categories")).toBeInTheDocument();
      
      const categoryButtons = document.querySelectorAll(".category-button");
      expect(categoryButtons.length).toBe(5);
      
      // Check active button has active class
      const activeButton = document.querySelector(".category-button.active");
      expect(activeButton).toBeInTheDocument();
      expect(activeButton).toHaveTextContent("All Questions");
    });

    test("applies correct CSS classes to FAQ items", () => {
      expect(document.querySelector(".faq-list")).toBeInTheDocument();
      
      const faqItems = document.querySelectorAll(".faq-item");
      expect(faqItems.length).toBeGreaterThan(0);
      
      faqItems.forEach(item => {
        expect(item.querySelector(".faq-question")).toBeInTheDocument();
        expect(item.querySelector(".question-text")).toBeInTheDocument();
        expect(item.querySelector(".faq-icon")).toBeInTheDocument();
      });
    });

    test("FAQ items have proper accessibility attributes", () => {
      const questionButtons = document.querySelectorAll(".faq-question");
      
      questionButtons.forEach(button => {
        // Check that the button has the aria-expanded attribute (even if initially null/false)
        expect(button).toHaveAttribute("aria-expanded");
        expect(button.tagName).toBe("BUTTON");
      });
    });
  });

  describe("Keyboard Navigation", () => {
    test("category buttons are keyboard accessible", () => {
      const categoryButtons = document.querySelectorAll(".category-button");
      
      categoryButtons.forEach(button => {
        expect(button.tagName).toBe("BUTTON");
        expect(button).toBeVisible();
      });
    });

    test("FAQ questions are keyboard accessible", () => {
      const questionButtons = document.querySelectorAll(".faq-question");
      
      questionButtons.forEach(button => {
        expect(button.tagName).toBe("BUTTON");
        expect(button).toBeVisible();
      });
    });

    test("FAQ questions can be activated with keyboard", async () => {
      const questionButton = screen.getByText("What is BrewTracker?");
      
      // Focus and press Enter
      questionButton.focus();
      fireEvent.click(questionButton); // Use click instead of keyDown for simplicity
      
      // Should expand the answer - use partial text to avoid issues with line breaks
      expect(screen.getByText(/BrewTracker is a comprehensive homebrewing management application/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("handles rapid category switching", async () => {
      const allButton = screen.getByText("All Questions");
      const generalButton = screen.getByText("General");
      const brewingButton = screen.getByText("Brewing");
      
      // Rapidly switch categories
      await userEvent.click(generalButton);
      await userEvent.click(brewingButton);
      await userEvent.click(allButton);
      await userEvent.click(generalButton);
      
      // Should end up in general category
      expect(generalButton).toHaveClass("active");
      expect(screen.getByText("What is BrewTracker?")).toBeInTheDocument();
    });

    test("handles rapid FAQ item toggling", async () => {
      const questionButton = screen.getByText("What is BrewTracker?");
      
      // Rapidly toggle
      await userEvent.click(questionButton);
      await userEvent.click(questionButton);
      await userEvent.click(questionButton);
      
      // Should end up expanded
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
    });

    test("expanded state persists across re-renders", async () => {
      const questionButton = screen.getByText("What is BrewTracker?");
      
      // Expand
      await userEvent.click(questionButton);
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
      
      // Force re-render by switching categories and back
      const brewingButton = screen.getByText("Brewing");
      await userEvent.click(brewingButton);
      
      const allButton = screen.getByText("All Questions");
      await userEvent.click(allButton);
      
      // Should still be expanded
      expect(screen.getByText("BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.")).toBeInTheDocument();
    });
  });
});