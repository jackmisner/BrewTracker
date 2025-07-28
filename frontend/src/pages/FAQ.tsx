import React, { useState } from "react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: "general" | "brewing" | "technical" | "features";
}

const FAQ: React.FC = () => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const faqData: FAQItem[] = [
    // General Questions
    {
      id: "what-is-brewtracker",
      question: "What is BrewTracker?",
      answer: "BrewTracker is a comprehensive homebrewing management application that helps you create recipes, track brewing sessions, and analyze your brewing data. It includes automatic calculation of brewing metrics, AI-powered recipe optimization, and tools for sharing recipes with the brewing community.",
      category: "general"
    },
    {
      id: "is-brewtracker-free",
      question: "Is BrewTracker free to use?",
      answer: "Yes! BrewTracker is completely free and open-source. You can use all features without any cost, and the source code is available on GitHub for transparency and community contributions.",
      category: "general"
    },
    {
      id: "data-privacy",
      question: "How is my brewing data protected?",
      answer: "Your recipes and brewing data are stored securely and are private by default. You control what information to share publicly. We don't sell or share your personal data with third parties. See our Privacy Policy for complete details.",
      category: "general"
    },

    // Brewing Questions
    {
      id: "calculation-accuracy",
      question: "How accurate are the brewing calculations?",
      answer: "BrewTracker uses established brewing formulas and industry standards for all calculations. Our formulas are based on methods from respected sources like Palmer's 'How to Brew' and Daniels' 'Designing Great Beers'. However, actual brewing results can vary due to equipment efficiency, ingredient variations, and process differences.",
      category: "brewing"
    },
    {
      id: "recipe-scaling",
      question: "Can I scale recipes to different batch sizes?",
      answer: "Yes! BrewTracker automatically scales ingredient amounts when you change the batch size. All calculations (OG, FG, ABV, IBU, SRM) are updated accordingly. You can also clone a recipe and modify the batch size for different brewing setups.",
      category: "brewing"
    },
    {
      id: "ingredient-substitutions",
      question: "How do I handle ingredient substitutions?",
      answer: "When substituting ingredients, update your recipe with the actual ingredients used. BrewTracker will recalculate all metrics based on the new ingredients. The AI system can also suggest appropriate substitutions to maintain style compliance.",
      category: "brewing"
    },
    {
      id: "efficiency-settings",
      question: "How do I account for my brewing efficiency?",
      answer: "BrewTracker uses standard extraction values for ingredients. You can adjust for your system's efficiency by modifying grain amounts based on your historical performance. Track actual vs. predicted values in brew sessions to understand your system's efficiency.",
      category: "brewing"
    },

    // Technical Questions
    {
      id: "browser-compatibility",
      question: "Which browsers are supported?",
      answer: "BrewTracker works best on modern browsers including Chrome, Firefox, Safari, and Edge. We recommend using the latest version of your preferred browser for the best experience.",
      category: "technical"
    },
    {
      id: "mobile-support",
      question: "Can I use BrewTracker on my phone or tablet?",
      answer: "Yes! BrewTracker is fully responsive and works well on mobile devices and tablets. You can access all features from your mobile browser, making it convenient to check recipes or log data while brewing.",
      category: "technical"
    },
    {
      id: "data-export",
      question: "Can I export my recipes and data?",
      answer: "Yes, you can export individual recipes in BeerXML format, which is compatible with most brewing software. We're working on additional export options for complete data backups.",
      category: "technical"
    },
    {
      id: "offline-access",
      question: "Does BrewTracker work offline?",
      answer: "Currently, BrewTracker requires an internet connection to function. Offline support is planned for future releases to allow viewing recipes and logging data while brewing without internet access.",
      category: "technical"
    },

    // Features
    {
      id: "ai-suggestions",
      question: "How do the AI recipe suggestions work?",
      answer: "The AI system analyzes your recipe against BJCP style guidelines and brewing science principles. It follows a systematic approach to suggest improvements for style compliance, including adjustments to malt bills, hop additions, and yeast selection while maintaining brewing realism.",
      category: "features"
    },
    {
      id: "public-recipes",
      question: "How do public recipes work?",
      answer: "You can choose to make your recipes public to share with the community. Public recipes can be viewed and cloned by other users, but only you can edit your original recipes. When someone clones your public recipe, they get an independent copy with proper attribution.",
      category: "features"
    },
    {
      id: "brew-sessions",
      question: "What's the difference between recipes and brew sessions?",
      answer: "Recipes are your planned brewing formulations with calculated values. Brew sessions are records of actual brewing attempts, where you can log real measurements, track fermentation progress, and note any deviations from the plan. This helps you improve your brewing process over time.",
      category: "features"
    },
    {
      id: "ingredient-database",
      question: "Where does the ingredient data come from?",
      answer: "Our ingredient database is compiled from reputable brewing sources and supplier specifications. We regularly update the database with new ingredients and improved data. If you notice missing or incorrect ingredient information, please let us know!",
      category: "features"
    }
  ];

  const categories = [
    { id: "all", label: "All Questions" },
    { id: "general", label: "General" },
    { id: "brewing", label: "Brewing" },
    { id: "features", label: "Features" },
    { id: "technical", label: "Technical" }
  ];

  const filteredFAQ = activeCategory === "all" 
    ? faqData 
    : faqData.filter(item => item.category === activeCategory);

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (openItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Frequently Asked Questions</h1>
        <p className="page-subtitle">
          Find answers to common questions about BrewTracker.
        </p>
      </div>
      
      <div className="content-container">
        {/* Category Filter */}
        <div className="card">
          <div className="faq-categories">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`category-button ${activeCategory === category.id ? 'active' : ''}`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Items */}
        <div className="faq-list">
          {filteredFAQ.map(item => (
            <div key={item.id} className="faq-item">
              <button
                className="faq-question"
                onClick={() => toggleItem(item.id)}
                aria-expanded={openItems.has(item.id)}
              >
                <span className="question-text">{item.question}</span>
                <span className={`faq-icon ${openItems.has(item.id) ? 'open' : ''}`}>
                  ▼
                </span>
              </button>
              
              {openItems.has(item.id) && (
                <div className="faq-answer">
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="card">
          <div className="card-title">Still Have Questions?</div>
          <div className="content-section">
            <p>
              If you can't find the answer you're looking for, here are some ways to get help:
            </p>
            <ul>
              <li>
                <a href="/report-bug">Report a bug</a> if you've found an issue
              </li>
              <li>
                <a href="/feature-request">Request a feature</a> through our feature request form
              </li>
              <li>
                Check out the <a href="/help">User Guide</a> for detailed instructions
              </li>
              <li>
                Learn more <a href="/about">About the developer</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;