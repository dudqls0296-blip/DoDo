import { createRoot } from 'react-dom/client';
import App from './App';
import { MusicProvider } from './music/Music';
import './styles.css';

createRoot(document.getElementById('root')!).render(<MusicProvider><App /></MusicProvider>);
