import React from 'react'
import KittenTTS from './components/KittenTTS'
import './App.css'

function App() {
  return (
    <div className="App">
      <header style={{ 
        textAlign: 'center', 
        padding: '2rem 0', 
        borderBottom: '1px solid #eee',
        marginBottom: '2rem' 
      }}>
        <h1 style={{ 
          fontSize: '3rem', 
          margin: '0 0 0.5rem 0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          KittenTTS Web
        </h1>
        <p style={{ 
          fontSize: '1.2rem', 
          color: '#666', 
          margin: 0,
          fontWeight: '300'
        }}>
          Ultra-lightweight Text-to-Speech in your browser 🐱
        </p>
      </header>
      
      <main style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '0 2rem' 
      }}>
        <KittenTTS />
        
        <footer style={{ 
          textAlign: 'center', 
          marginTop: '3rem', 
          padding: '2rem 0', 
          borderTop: '1px solid #eee',
          fontSize: '0.9rem',
          color: '#888'
        }}>
          <p>
            Powered by{' '}
            <a 
              href="https://github.com/KittenML/KittenTTS" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#667eea', 
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: '500'
              }}
            >
              KittenTTS
            </a>
            {' '}and{' '}
            <a 
              href="https://onnxruntime.ai/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#667eea', 
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: '500'
              }}
            >
              ONNX Runtime Web
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
