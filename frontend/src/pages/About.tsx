import React from 'react';
import './About.scss';

const About: React.FC = () => {
  return (
    <div className="about-page">
      <div className="about-hero">
        <h1>About Vibecoders</h1>
        <p className="about-subtitle">Simplifying app development for developers everywhere</p>
      </div>

      <div className="about-content">
        <section className="about-section">
          <h2>Our Vision</h2>
          <p>
            Vibecoders was born from a simple idea: making app development accessible, intuitive, and enjoyable. 
            We believe that developers should focus on creating amazing experiences, not wrestling with complex 
            integrations and configurations.
          </p>
          <p>
            Our mission is to provide a platform where developers can easily create, manage, and integrate their 
            apps with powerful AI services like Groq, streamlining the development process and enabling faster 
            innovation.
          </p>
        </section>

        <section className="about-section">
          <h2>What We Offer</h2>
          <ul className="features-list">
            <li>🚀 <strong>Easy App Creation:</strong> Create and manage multiple apps from one intuitive dashboard</li>
            <li>🔗 <strong>Seamless Integrations:</strong> Connect with Groq API and other services effortlessly</li>
            <li>👥 <strong>Role-Based Access:</strong> Developer and admin roles with appropriate permissions</li>
            <li>🌓 <strong>Dark & Light Mode:</strong> Work in your preferred theme</li>
            <li>📊 <strong>Analytics & Insights:</strong> Track your app performance and usage</li>
            <li>🔒 <strong>Privacy First:</strong> Full control over your data and privacy settings</li>
          </ul>
        </section>

        <section className="about-section">
          <h2>Get Started</h2>
          <p>
            Ready to start vibecoding? Sign up for free and create your first app today. 
            Join our community of developers building the next generation of applications.
          </p>
        </section>

        <section className="about-section">
          <h2>Connect With Us</h2>
          <p>
            Have questions, suggestions, or want to contribute? We'd love to hear from you!
          </p>
          <div className="contact-links">
            <a href="#" className="btn btn--primary">Community Forum</a>
            <a href="#" className="btn btn--secondary">Blog</a>
            <a href="#" className="btn btn--secondary">Resources</a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;

