import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/bar.css';
import { App } from './app.tsx';
import { boot } from './data/store.ts';
import { startSync } from './data/sync.ts';

render(<App />, document.getElementById('app')!);
void boot().then(startSync);
