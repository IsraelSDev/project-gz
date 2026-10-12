import { useSyncExternalStore } from 'react';
import type { GameSnapshot, GameStateReader } from '@/game/application/GameController';

/**
 * Lê uma FATIA do snapshot da partida com `useSyncExternalStore`. Não há cópia do estado no React:
 * o componente re-renderiza só quando o valor selecionado muda, e a assinatura é cancelada ao
 * desmontar. Sem `getServerSnapshot` próprio: o estado é o mesmo no servidor e no cliente.
 *
 * O seletor DEVE devolver uma referência já existente no snapshot (um campo como `s.resources` ou
 * `s.buildings`, ou um valor simples como `s.tick`), nunca um objeto ou lista montados na hora: o
 * `useSyncExternalStore` compara por `Object.is` e um valor novo a cada leitura causaria laço de
 * atualização. Como os passos da simulação mantêm a referência do que não mudou, ler só a fatia
 * evita re-renderizar a interface inteira a cada tick.
 */
export function useGameSelector<T>(
  source: GameStateReader,
  selector: (snapshot: GameSnapshot) => T,
): T {
  const getSelected = () => selector(source.getSnapshot());
  return useSyncExternalStore(source.subscribe, getSelected, getSelected);
}
