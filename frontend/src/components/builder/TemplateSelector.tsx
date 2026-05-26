import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../utils/hooks';
import { generateApp } from '../../store/slices/generationSlice';
import './TemplateSelector.scss';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  prompt: string;
  preview?: string;
}

const templates: Template[] = [
  {
    id: 'todo',
    name: 'Todo App',
    description: 'A simple task management app with add, edit, delete, and mark as complete',
    category: 'productivity',
    icon: '✅',
    prompt: 'Create a todo app with the following features: add tasks, mark tasks as complete, delete tasks, filter tasks by status (all/active/completed), and persist data to localStorage. Use React hooks and modern UI design.'
  },
  {
    id: 'blog',
    name: 'Blog Platform',
    description: 'A blog with posts, comments, and user authentication',
    category: 'content',
    icon: '📝',
    prompt: 'Create a blog platform with: post creation and editing, user authentication, comments on posts, categories and tags, search functionality, and a modern card-based design using React.'
  },
  {
    id: 'dashboard',
    name: 'Analytics Dashboard',
    description: 'A data visualization dashboard with charts and metrics',
    category: 'analytics',
    icon: '📊',
    prompt: 'Create an analytics dashboard with: multiple chart types (line, bar, pie), real-time data updates, metric cards with statistics, date range filters, and a responsive grid layout using React and a charting library.'
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Store',
    description: 'An online store with products, cart, and checkout',
    category: 'commerce',
    icon: '🛒',
    prompt: 'Create an e-commerce store with: product listing with filters, product detail pages, shopping cart, checkout process, user authentication, and payment integration mock. Use React with a modern e-commerce UI.'
  },
  {
    id: 'chat',
    name: 'Chat App',
    description: 'A real-time messaging application',
    category: 'communication',
    icon: '💬',
    prompt: 'Create a chat application with: real-time messaging, user authentication, chat rooms or direct messages, message history, typing indicators, and online status. Use React with a modern chat UI design.'
  },
  {
    id: 'portfolio',
    name: 'Portfolio Website',
    description: 'A personal portfolio site with projects and contact form',
    category: 'portfolio',
    icon: '🎨',
    prompt: 'Create a portfolio website with: hero section, about me section, projects gallery, skills section, contact form with validation, and smooth scrolling navigation. Use React with a modern, responsive design.'
  }
];

interface TemplateSelectorProps {
  onSelect?: (template: Template) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState<string | null>(null);

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const handleTemplateSelect = async (template: Template) => {
    if (onSelect) {
      onSelect(template);
      return;
    }

    setLoading(template.id);
    try {
      const result = await dispatch(generateApp({
        prompt: template.prompt,
        appType: 'web'
      }));

      if (generateApp.fulfilled.match(result)) {
        navigate(`/apps/${result.payload.app._id}/builder`);
      }
    } catch (error) {
      console.error('Template generation error:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="template-selector">
      <div className="template-header">
        <h2>Choose a Template</h2>
        <p>Start with a pre-built app template or create from scratch</p>
      </div>

      <div className="template-categories">
        {categories.map(category => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      <div className="template-grid">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className="template-card"
            onClick={() => handleTemplateSelect(template)}
          >
            <div className="template-icon">{template.icon}</div>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <div className="template-footer">
              <span className="template-category">{template.category}</span>
              <button
                className="btn btn--primary btn--small"
                disabled={loading === template.id}
              >
                {loading === template.id ? 'Generating...' : 'Use Template'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;

