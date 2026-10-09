import type { PonteSelene } from '../shared/contratos';

declare global {
    interface Window {
        selene?: PonteSelene;
    }
}
