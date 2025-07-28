import React from "react";

const About: React.FC = () => {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">About Me</h1>
      </div>
      
      <div className="content-container">
        <div className="card">
          <div className="card-title">Developer & Brewing Enthusiast</div>
          <div className="content-section">
            <h2>Hello! 👋</h2>
            <p>
              I'm Jack Misner, a software developer and homebrewing enthusiast who created 
              BrewTracker to solve a personal problem: keeping track of recipes, brewing 
              sessions, and all the calculations that go into making great beer.
            </p>
            
            <div className="about-photo-section">
              <img 
                src={require("../images/jack-beer-hall.jpg")} 
                alt="Jack enjoying traditional German beer in a beer hall" 
                className="about-photo"
              />
              <p className="photo-caption">
                Enjoying traditional German beer - experiences like this fueled my passion 
                for brewing and inspired me to create better tools for fellow beer enthusiasts! 🍺
              </p>
            </div>
            
            <h2>The Story Behind BrewTracker 🍺</h2>
            <p>
              As someone who loves both coding and brewing, I found myself constantly 
              switching between different tools and spreadsheets to manage my homebrew 
              recipes and track my brewing sessions. I wanted a single, comprehensive 
              tool that could:
            </p>
            <ul>
              <li>Calculate brewing metrics accurately (OG, FG, ABV, IBU, SRM)</li>
              <li>Store and organize recipes with proper version control</li>
              <li>Track brewing sessions from grain to glass</li>
              <li>Analyze yeast performance over time</li>
              <li>Share recipes with the brewing community</li>
            </ul>
            
            <div className="about-photo-section">
              <img 
                src={require("../images/homebrew-bottles-2015.jpg")} 
                alt="Golden Promise IPA homebrew bottles from 2015" 
                className="about-photo homebrew-photo"
              />
              <p className="photo-caption">
                My Golden Promise IPA from 2015 - one of my early brewing successes that 
                highlighted the need for better recipe management and tracking tools. 
                The journey from this batch to BrewTracker spans nearly a decade of brewing passion!
              </p>
            </div>
            
            <h2>Technology & Approach 💻</h2>
            <p>
              BrewTracker is built with modern web technologies including React, TypeScript, 
              Flask, and MongoDB. The application focuses on accuracy, usability, and 
              respect for brewing science. All calculations are based on established 
              brewing formulas and industry standards.
            </p>
            
            <h2>Open Source & Community 🌟</h2>
            <p>
              BrewTracker is free software licensed under the GPL v3, ensuring it remains 
              open and accessible to the brewing community forever. This means:
            </p>
            <ul>
              <li>The software is completely free for all homebrewers</li>
              <li>Any improvements must be shared back with the community</li>
              <li>Commercial derivatives must also be open source</li>
              <li>Brewing knowledge and calculations stay accessible to everyone</li>
            </ul>
            <p>
              I believe in giving back to the brewing and developer communities that have 
              taught me so much. Contributions, feedback, and feature requests are always welcome!
            </p>
            
            <h2>Get In Touch 📧</h2>
            <p>
              Whether you want to discuss brewing, code, or just say hello, feel free 
              to reach out:
            </p>
            <ul>
              <li>
                <a 
                  href="https://github.com/jackmisner" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  GitHub Profile
                </a>
              </li>
              <li>
                <a 
                  href="https://www.linkedin.com/in/jack-d-misner/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </li>
                <li>
                <a href="mailto:jack@brewtracker.co.uk">jack@brewtracker.co.uk</a>
                </li>
            </ul>
            
            <div className="callout">
              <p>
                <strong>Cheers to great beer and clean code!</strong> 🍻
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;