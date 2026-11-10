import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../../lib/useSeo';

const SWAGGER_CSS = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css';
const SWAGGER_JS = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js';

export default function SwaggerPage() {
  const containerRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  useSeo({ title: 'API Reference – Maps By FUTA' });

  useEffect(() => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = SWAGGER_CSS;
    document.head.appendChild(stylesheet);

    const script = document.createElement('script');
    script.src = SWAGGER_JS;
    script.async = true;
    script.onload = () => {
      if (!window.SwaggerUIBundle || !containerRef.current) {
        setLoadError('Swagger UI loaded without its initializer. Please reload this page.');
        return;
      }
      window.SwaggerUIBundle({
        url: '/openapi.json',
        domNode: containerRef.current,
        deepLinking: true,
        displayRequestDuration: true,
      });
    };
    script.onerror = () => setLoadError('Swagger UI could not be loaded. Check your connection and reload this page.');
    document.body.appendChild(script);

    return () => {
      stylesheet.remove();
      script.remove();
    };
  }, []);

  return (
    <main>
      <header style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', padding: '16px 24px' }}>
        <Link to="/developers/docs">Back to API docs</Link>
        <a href="/openapi.json" target="_blank" rel="noreferrer">OpenAPI JSON</a>
      </header>
      {loadError && <p role="alert" style={{ color: '#b42318', padding: '0 24px' }}>{loadError}</p>}
      <div ref={containerRef} />
    </main>
  );
}
