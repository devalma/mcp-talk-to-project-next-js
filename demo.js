#!/usr/bin/env node

/**
 * Demo script showing the MCP server capabilities
 * Run this to see what information the server can extract
 */

import fs from 'fs';
import path from 'path';

// Create a simple demo Next.js structure for testing
const demoPath = path.join(process.cwd(), 'demo-project');

console.log('📂 Creating demo Next.js project structure...');

// Create demo project structure
const demoFiles = {
  'package.json': JSON.stringify({
    name: "demo-nextjs-app",
    version: "1.0.0",
    dependencies: {
      next: "^13.0.0",
      react: "^18.0.0"
    }
  }, null, 2),
  
  'pages/index.js': `
import { useState } from 'react';
import Button from '../components/Button';

export default function HomePage({ posts }) {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Welcome to Next.js</h1>
      <Button onClick={() => setCount(count + 1)}>
        Count: {count}
      </Button>
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      posts: []
    }
  };
}
  `,
  
  'pages/blog/[slug].js': `
export default function BlogPost({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}

export async function getStaticProps({ params }) {
  return {
    props: {
      post: { title: 'Demo Post', content: 'Demo content' }
    }
  };
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: true
  };
}
  `,
  
  'pages/api/users.js': `
export default function handler(req, res) {
  if (req.method === 'GET') {
    res.json({ users: [] });
  } else if (req.method === 'POST') {
    res.json({ created: true });
  } else {
    res.status(405).end();
  }
}
  `,
  
  'components/Button.js': `
import { useState } from 'react';

export default function Button({ children, onClick, variant = 'primary' }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={\`btn btn-\${variant} \${isHovered ? 'hovered' : ''}\`}
    >
      {children}
    </button>
  );
}
  `,
  
  'hooks/useAuth.js': `
import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  
  const login = async (credentials) => {
    setLoading(true);
    // Login logic here
    setLoading(false);
  };
  
  const logout = () => {
    // Logout logic
  };
  
  return {
    user: context.user,
    login,
    logout,
    loading
  };
}
  `,
  
  'context/AuthContext.js': `
import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  
  const value = {
    user,
    setUser
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
  `
};

// Create demo files
function createDemoProject() {
  if (fs.existsSync(demoPath)) {
    console.log('Demo project already exists, skipping creation...');
    return;
  }
  
  fs.mkdirSync(demoPath, { recursive: true });
  
  for (const [filePath, content] of Object.entries(demoFiles)) {
    const fullPath = path.join(demoPath, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim());
  }
  
  console.log(`✅ Demo project created at: ${demoPath}`);
}

// Clean up demo project
function cleanupDemo() {
  if (fs.existsSync(demoPath)) {
    fs.rmSync(demoPath, { recursive: true, force: true });
    console.log('🧹 Demo project cleaned up');
  }
}

// Main demo function
async function runDemo() {
  createDemoProject();
  
  console.log('\n🧪 Running MCP server demo...');
  console.log('================================');
  
  // Import and test our functions
  try {
    const { extractComponents } = await import('./dist/extractors/component.js');
    const { extractHooks } = await import('./dist/extractors/hook.js');
    const { extractPages } = await import('./dist/extractors/page.js');
    const { extractFeatures } = await import('./dist/extractors/feature.js');
    
    console.log('\n📦 Components found:');
    const components = extractComponents(demoPath, undefined, true, true);
    components.forEach(comp => {
      console.log(`   - ${comp.name} (${comp.type}) in ${comp.file}`);
      if (comp.props && comp.props.length > 0) {
        console.log(`     Props: ${comp.props.map(p => p.name).join(', ')}`);
      }
    });
    
    console.log('\n🎣 Hooks found:');
    const hooks = extractHooks(demoPath, undefined, true, true);
    hooks.forEach(hook => {
      console.log(`   - ${hook.name} (${hook.type}) in ${hook.file}`);
    });
    
    console.log('\n📄 Pages found:');
    const pages = extractPages(demoPath, undefined, true);
    pages.forEach(page => {
      console.log(`   - ${page.route} -> ${page.file} (${page.type})`);
      if (page.dataFetching && page.dataFetching.length > 0) {
        console.log(`     Data fetching: ${page.dataFetching.join(', ')}`);
      }
    });
    
    console.log('\n✅ Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
  
  // Ask if user wants to keep demo project
  console.log('\n💡 Demo project created for testing. Run with:');
  console.log(`   export NEXTJS_PROJECT_PATH="${demoPath}"`);
  console.log('   npm start');
  console.log('\nOr clean up with:');
  console.log('   node demo.js cleanup');
}

// Handle cleanup command
if (process.argv[2] === 'cleanup') {
  cleanupDemo();
} else {
  runDemo().catch(console.error);
}
