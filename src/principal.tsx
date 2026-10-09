import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicativo } from './Aplicativo';
import './tailwind.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('A raiz da interface não foi encontrada.');
createRoot(raiz).render(
    <StrictMode>
        <Aplicativo />
    </StrictMode>,
);
