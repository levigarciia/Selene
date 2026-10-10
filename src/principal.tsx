import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicativo } from './Aplicativo';
import { AcessoNavegador } from './components/AcessoNavegador';
import { EfeitoComputador } from './components/EfeitoComputador';
import './tailwind.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('A raiz da interface não foi encontrada.');
const efeitoComputador = new URLSearchParams(window.location.search).get('efeitoComputador');
if (efeitoComputador) {
    document.documentElement.classList.remove('bg-fundo');
    document.documentElement.classList.add('bg-transparent');
}
createRoot(raiz).render(<StrictMode>{efeitoComputador ? <EfeitoComputador tipo={efeitoComputador} /> :
    window.selene ? <Aplicativo /> : <AcessoNavegador />}</StrictMode>);
