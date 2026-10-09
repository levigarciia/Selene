import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicativo } from './Aplicativo';
import './estilos.css';
import './styles/barraLateral.css';
import './styles/estatisticas.css';
import './styles/projetos.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('A raiz da interface não foi encontrada.');
createRoot(raiz).render(
    <StrictMode>
        <Aplicativo />
    </StrictMode>,
);
