import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { INDEPENDENT_CIVILIZATIONS } from '@/game/content/independentCivilizations';
import { createGameController } from '@/game/application/GameController';
import { decodeGameSave, encodeGameSave } from '@/game/application/saveGame';
import { explorePointCommand } from '@/game/domain/exploration/exploreCommand';
import { resolveEventCommand } from '@/game/domain/events/resolveEventCommand';
import { diplomaticActionCommand } from '@/game/domain/diplomacy/diplomacyCommands';
import { militaryActionCommand } from '@/game/domain/military/militaryCommands';
import { advanceEvents } from '@/game/domain/events/advanceEvents';
import { executeSimulationCommand } from '@/game/domain/commands/simulationCommand';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import type { GameState } from '@/game/domain/state/GameState';

const initial = () => createInitialGameState(INITIAL_SCENARIO);
const run = (state: GameState, command: Parameters<typeof executeSimulationCommand>[1]) =>
  executeSimulationCommand(state, command);

describe('diplomacia da Fase 13', () => {
  it('cria três civilizações originais desconhecidas com IDs estáveis', () => {
    const state = initial();
    expect(Object.keys(INDEPENDENT_CIVILIZATIONS)).toEqual([
      'selari-commons',
      'oruun-clans',
      'ithari-gardeners',
    ]);
    expect(state.diplomacy.civilizations).toHaveLength(3);
    expect(state.diplomacy.civilizations.every((entry) => entry.contactStatus === 'unknown')).toBe(
      true,
    );
    expect(validateGameState(state)).toEqual([]);
  });

  it('descobre a sociedade ao explorar seu ponto e ativa um evento único de primeiro contato', () => {
    const explored = run(initial(), explorePointCommand('crystal-spring'));
    expect(explored.ok).toBe(true);
    if (!explored.ok) return;
    const discovered = explored.value.diplomacy.civilizations.find(
      (entry) => entry.civilizationId === 'selari-commons',
    );
    expect(discovered).toMatchObject({ contactStatus: 'discovered', relationshipScore: 0 });
    expect(discovered?.history).toMatchObject([{ action: 'civilization-discovered', tick: 0 }]);
    const withEvent = advanceEvents(explored.value);
    expect(
      withEvent.events.find((event) => event.eventId === 'signal-selari-commons')?.status,
    ).toBe('active');
    expect(advanceEvents(withEvent)).toBe(withEvent);
  });

  it('estabelece contato pelo evento uma vez e aplica relação baseada no líder', () => {
    const explored = run(initial(), explorePointCommand('crystal-spring'));
    if (!explored.ok) throw new Error('A exploração inicial deveria funcionar.');
    const active = advanceEvents(explored.value);
    const greeted = run(active, resolveEventCommand('signal-selari-commons', 'send-greeting'));
    expect(greeted.ok).toBe(true);
    if (!greeted.ok) return;
    expect(greeted.value.diplomacy.civilizations[0]).toMatchObject({
      civilizationId: 'selari-commons',
      contactStatus: 'contacted',
      relationshipScore: 10,
    });
    expect(
      run(greeted.value, resolveEventCommand('signal-selari-commons', 'send-greeting')),
    ).toMatchObject({
      ok: false,
      error: 'EVENT_NOT_ACTIVE',
    });
    expect(validateGameState(greeted.value)).toEqual([]);
  });

  it('registra hostilidade no primeiro contato, sem iniciar combate', () => {
    const explored = run(initial(), explorePointCommand('luminous-grove'));
    if (!explored.ok) throw new Error('A exploração inicial deveria funcionar.');
    const active = advanceEvents(explored.value);
    const guarded = run(active, resolveEventCommand('signal-ithari-gardeners', 'send-warning'));
    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    expect(
      guarded.value.diplomacy.civilizations.find(
        (item) => item.civilizationId === 'ithari-gardeners',
      ),
    ).toMatchObject({ contactStatus: 'contacted', relationshipScore: -30 });
    expect(guarded.value).not.toHaveProperty('armies');
  });

  it('permite adiar o sinal sem fechar a possibilidade de contato posterior', () => {
    const explored = run(initial(), explorePointCommand('crystal-spring'));
    if (!explored.ok) throw new Error('A exploração inicial deveria funcionar.');
    const active = advanceEvents(explored.value);
    const deferred = run(active, resolveEventCommand('signal-selari-commons', 'defer-contact'));
    expect(deferred.ok).toBe(true);
    if (!deferred.ok) return;
    expect(deferred.value.diplomacy.civilizations[0]).toMatchObject({
      contactStatus: 'discovered',
    });
    expect(deferred.value.diplomacy.civilizations[0]?.history.at(-1)?.action).toBe(
      'signal-deferred',
    );
    expect(
      run(deferred.value, diplomaticActionCommand('selari-commons', 'establish-contact')).ok,
    ).toBe(true);
  });

  it('registra informações, cobra presente uma vez, decide o pacto deterministicamente e salva tudo', () => {
    const explored = run(initial(), explorePointCommand('crystal-spring'));
    if (!explored.ok) throw new Error('A exploração inicial deveria funcionar.');
    const contacted = run(
      explored.value,
      diplomaticActionCommand('selari-commons', 'establish-contact'),
    );
    expect(contacted.ok).toBe(true);
    if (!contacted.ok) return;
    const information = run(
      contacted.value,
      diplomaticActionCommand('selari-commons', 'request-information'),
    );
    expect(information.ok).toBe(true);
    if (!information.ok) return;
    const gift = run(information.value, diplomaticActionCommand('selari-commons', 'offer-gift'));
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;
    expect(gift.value.resources.materials).toBe(information.value.resources.materials - 10);
    expect(run(gift.value, diplomaticActionCommand('selari-commons', 'offer-gift'))).toMatchObject({
      ok: false,
      error: 'DIPLOMACY_ALREADY_COMPLETED',
    });
    const pact = run(
      gift.value,
      diplomaticActionCommand('selari-commons', 'propose-non-aggression-pact'),
    );
    expect(pact.ok).toBe(true);
    if (!pact.ok) return;
    expect(pact.value.diplomacy.civilizations[0]?.nonAggressionPact).toBe('active');
    const encoded = encodeGameSave(pact.value);
    const decoded = decodeGameSave(encoded);
    expect(decoded).toMatchObject({ ok: true, value: { diplomacy: pact.value.diplomacy } });
    expect(validateGameState(pact.value)).toEqual([]);
  });

  it('recusa presente sem estoque e rejeita estados diplomáticos contraditórios', () => {
    const state = initial();
    const withoutMaterials = { ...state, resources: { ...state.resources, materials: 0 } };
    const explored = run(withoutMaterials, explorePointCommand('crystal-spring'));
    if (!explored.ok) throw new Error('A exploração inicial deveria funcionar.');
    const contacted = run(
      explored.value,
      diplomaticActionCommand('selari-commons', 'establish-contact'),
    );
    if (!contacted.ok) throw new Error('O contato deveria funcionar.');
    expect(
      run(contacted.value, diplomaticActionCommand('selari-commons', 'offer-gift')),
    ).toMatchObject({ ok: false, error: 'INSUFFICIENT_RESOURCES' });

    const contradictory = {
      ...initial(),
      diplomacy: {
        civilizations: initial().diplomacy.civilizations.map((relation) =>
          relation.civilizationId === 'selari-commons'
            ? { ...relation, contactStatus: 'contacted' as const }
            : relation,
        ),
      },
    };
    expect(validateGameState(contradictory).length).toBeGreaterThan(0);
  });

  it('aplica comandos com pausa sem avançar tick', () => {
    const state = initial();
    const controller = createGameController(state);
    controller.submitCommand(explorePointCommand('crystal-spring'));
    controller.submitCommand(diplomaticActionCommand('selari-commons', 'establish-contact'));
    expect(controller.getSnapshot().tick).toBe(0);
    expect(controller.getSnapshot().diplomacy.civilizations[0]?.contactStatus).toBe('contacted');
  });

  it('registra recusa de pacto e impede proposta duplicada', () => {
    const state = initial();
    const ready = {
      ...state,
      research: { ...state.research, unlockedTechnologyIds: ['protein-cultures'] },
    };
    const explored = run(ready, explorePointCommand('echo-ruins'));
    if (!explored.ok) throw new Error('A exploração inicial deveria funcionar.');
    const greeted = run(
      explored.value,
      diplomaticActionCommand('oruun-clans', 'establish-contact'),
    );
    if (!greeted.ok) throw new Error('O contato deveria funcionar.');
    const proposal = run(
      greeted.value,
      diplomaticActionCommand('oruun-clans', 'propose-non-aggression-pact'),
    );
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(
      proposal.value.diplomacy.civilizations.find((item) => item.civilizationId === 'oruun-clans'),
    ).toMatchObject({ nonAggressionPact: 'rejected' });
    expect(
      run(proposal.value, diplomaticActionCommand('oruun-clans', 'propose-non-aggression-pact')),
    ).toMatchObject({ ok: false, error: 'DIPLOMACY_ALREADY_COMPLETED' });
  });

  it('permite provocar uma sociedade até a hostilidade e então declarar guerra', () => {
    const explored = run(initial(), explorePointCommand('crystal-spring'));
    if (!explored.ok) throw new Error('A exploração inicial deveria funcionar.');
    const contacted = run(
      explored.value,
      diplomaticActionCommand('selari-commons', 'establish-contact'),
    );
    if (!contacted.ok) throw new Error('O contato deveria funcionar.');
    const firstProvocation = run(
      contacted.value,
      diplomaticActionCommand('selari-commons', 'provoke'),
    );
    expect(firstProvocation.ok).toBe(true);
    if (!firstProvocation.ok) return;
    expect(firstProvocation.value.diplomacy.civilizations[0]?.relationshipScore).toBe(-10);
    const secondProvocation = run(
      firstProvocation.value,
      diplomaticActionCommand('selari-commons', 'provoke'),
    );
    expect(secondProvocation.ok).toBe(true);
    if (!secondProvocation.ok) return;
    expect(secondProvocation.value.diplomacy.civilizations[0]).toMatchObject({
      relationshipScore: -30,
      history: expect.arrayContaining([
        expect.objectContaining({ action: 'provocation', relationshipChange: -20 }),
      ]),
    });
    const war = run(
      secondProvocation.value,
      militaryActionCommand('declare-war', { civilizationId: 'selari-commons' }),
    );
    expect(war.ok).toBe(true);
    if (!war.ok) return;
    expect(war.value.diplomacy.civilizations[0]).toMatchObject({
      warStatus: 'active',
      relationshipScore: -35,
    });
    expect(validateGameState(war.value)).toEqual([]);
  });

  it('migra save schema 4 preservando progresso e descobertas exploradas', () => {
    const state = initial();
    const v4 = {
      ...state,
      schemaVersion: 4,
      contentVersion: '0.7.0',
      exploration: { discoveredPointIds: ['crystal-spring'] },
      diplomacy: undefined,
      military: undefined,
      events: state.events.filter(
        (event) => event.eventId === 'wreck-signal' || event.eventId === 'ruins-cache',
      ),
    };
    const legacy = { ...v4 } as Record<string, unknown>;
    delete legacy.diplomacy;
    delete legacy.military;
    delete legacy.settlements;
    delete legacy.territory;
    const decoded = decodeGameSave(
      JSON.stringify({ format: 'alien-civilization-save', formatVersion: 1, state: legacy }),
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toMatchObject({
      schemaVersion: 7,
      contentVersion: '0.10.0',
      tick: state.tick,
    });
    expect(
      decoded.value.diplomacy.civilizations.find(
        (item) => item.civilizationId === 'selari-commons',
      ),
    ).toMatchObject({ contactStatus: 'discovered' });
    expect(
      decoded.value.diplomacy.civilizations.find((item) => item.civilizationId === 'oruun-clans'),
    ).toMatchObject({ contactStatus: 'unknown' });
    expect(decoded.value.events.some((event) => event.eventId === 'signal-selari-commons')).toBe(
      true,
    );
  });

  it('não permite ações antes da descoberta nem contacto em civilização desconhecida', () => {
    expect(
      run(initial(), diplomaticActionCommand('selari-commons', 'establish-contact')),
    ).toMatchObject({ ok: false, error: 'DIPLOMACY_REQUIREMENT_NOT_MET' });
    expect(run(initial(), diplomaticActionCommand('unknown-id', 'offer-gift'))).toMatchObject({
      ok: false,
      error: 'INVALID_COMMAND',
    });
  });

  it('representa a colônia com o governante designado sem criar uma segunda liderança', () => {
    const controller = createGameController(initial());
    expect(controller.getSnapshot().government.leaderId).toBe('colonist-aru');
    expect(controller.getSnapshot().diplomacy.civilizations).toHaveLength(3);
  });
});
