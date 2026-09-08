import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toaster position="top-right" richColors closeButton duration={2500} />
    <App />
  </StrictMode>,
);
