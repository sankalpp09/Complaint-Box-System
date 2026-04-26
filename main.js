// ============================================================
//  src/main.js  —  App Entry Point
// ============================================================
import './styles/main.css';
import { startAuthListener, navigate } from './app.js';

// Boot the app
startAuthListener();
navigate('landing');
