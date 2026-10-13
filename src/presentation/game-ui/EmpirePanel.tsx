import { useState } from 'react';
import type { ResourceId } from '@/game/content/resources';
import type { BuildingDefinition } from '@/game/content/buildings';
import {
  requestTerritoryAction,
  selectSettlements,
  TERRITORY_PANEL_CONTENT,
} from '@/game/application/territory';
import type { GameController } from '@/game/application/GameController';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';
import { selectBuildingCost } from '@/game/application/buildSelectors';

const format = new Intl.NumberFormat('pt-BR');
const {
  buildings: BUILDING_DEFINITIONS,
  regions: REGION_DEFINITIONS,
  civilizations: INDEPENDENT_CIVILIZATIONS,
  foundingCost: SETTLEMENT_FOUNDING_COST,
  resources: RESOURCE_DEFINITIONS,
  resourceIds: RESOURCE_IDS,
  building: getBuildingDefinition,
} = TERRITORY_PANEL_CONTENT;
const actionError = (error: string) => {
  if (error === 'INSUFFICIENT_RESOURCES')
    return 'Faltam recursos no capital ou na cidade selecionada.';
  if (error === 'COMMAND_REJECTED') return 'A operação não atende aos requisitos atuais.';
  return 'Não foi possível concluir a ação territorial.';
};

export function EmpirePanel({ controller }: { readonly controller: GameController }) {
  const resources = useGameSelector(controller, (state) => state.resources);
  const discoveredPoints = useGameSelector(
    controller,
    (state) => state.exploration.discoveredPointIds,
  );
  const settlements = useGameSelector(controller, (state) => state.settlements);
  const regions = useGameSelector(controller, (state) => state.territory.regions);
  const population = useGameSelector(controller, (state) => state.population);
  const characters = useGameSelector(controller, (state) => state.characters);
  const government = useGameSelector(controller, (state) => state.government);
  const diplomacy = useGameSelector(controller, (state) => state.diplomacy);
  const research = useGameSelector(controller, (state) => state.research);
  const snapshot = controller.getSnapshot();
  const cities = selectSettlements(snapshot);
  const [selectedId, setSelectedId] = useState('settlement-capital');
  const [resourceId, setResourceId] = useState<ResourceId>('food');
  const [transferAmount, setTransferAmount] = useState(20);
  const [peopleAmount, setPeopleAmount] = useState(1);
  const [feedback, setFeedback] = useState('');
  const selected = cities.find((city) => city.settlementId === selectedId) ?? cities[0]!;
  const known = new Set(discoveredPoints);
  const usedCharacters = new Set(
    [
      government.leaderId,
      ...Object.values(government.offices),
      ...settlements.map((city) => city.administratorId),
    ].filter((id): id is string => id !== null),
  );
  const assignedHere =
    selectedId === 'settlement-capital'
      ? government.leaderId
      : (settlements.find((city) => city.settlementId === selectedId)?.administratorId ?? null);
  const administrators = characters.filter(
    (person) =>
      person.alive &&
      person.available &&
      person.skills.leadership >= 2 &&
      (!usedCharacters.has(person.characterId) || person.characterId === assignedHere),
  );
  const totalPopulation =
    population.survivors + settlements.reduce((sum, city) => sum + city.population.survivors, 0);
  const send = (
    action: Parameters<typeof requestTerritoryAction>[1],
    fields: Parameters<typeof requestTerritoryAction>[2],
  ) => {
    const result = requestTerritoryAction(controller, action, fields);
    setFeedback(
      result.ok
        ? result.value === 'queued'
          ? 'Operação enviada; será aplicada no próximo tick.'
          : 'Operação concluída.'
        : actionError(result.error),
    );
  };

  return (
    <section className="hud-panel empire-panel" aria-label="Território e cidades">
      <h2 className="hud-panel__title">Território e cidades</h2>
      <p>
        {
          regions.filter(
            (region) =>
              region.regionId === 'crash-site' ||
              (REGION_DEFINITIONS[region.regionId].discoveryPointId &&
                known.has(REGION_DEFINITIONS[region.regionId].discoveryPointId!)),
          ).length
        }{' '}
        regiões conhecidas · {cities.length} assentamentos · {totalPopulation} habitantes
      </p>

      <h3>Regiões</h3>
      <ul className="empire-region-list">
        {regions.map((region) => {
          const definition = REGION_DEFINITIONS[region.regionId];
          const discovered =
            region.regionId === 'crash-site' ||
            (!!definition.discoveryPointId && known.has(definition.discoveryPointId));
          const city = settlements.find((item) => item.settlementId === region.settlementId);
          const controllerLabel =
            region.owner === 'colony'
              ? (city?.name ?? 'Capital')
              : region.owner === 'civilization'
                ? (INDEPENDENT_CIVILIZATIONS[
                    region.civilizationId! as keyof typeof INDEPENDENT_CIVILIZATIONS
                  ]?.name ?? 'Outra civilização')
                : 'Sem controle';
          const relation = region.civilizationId
            ? diplomacy.civilizations.find(
                (entry) => entry.civilizationId === region.civilizationId,
              )
            : undefined;
          const pactRequired =
            region.owner === 'civilization' && relation?.nonAggressionPact !== 'active';
          const hostile = (relation?.relationshipScore ?? 0) <= -30;
          const atWar = relation?.warStatus === 'active';
          return (
            <li key={region.regionId}>
              <article>
                <strong>{discovered ? definition.name : 'Região não explorada'}</strong>
                <small>
                  {discovered
                    ? definition.environment
                    : 'Explore pontos de interesse para revelar esta região.'}
                </small>
                <small>
                  {discovered ? `Controle: ${controllerLabel}` : 'Estado: desconhecida'}
                </small>
                {discovered && (region.owner === null || region.owner === 'civilization') && (
                  <button
                    type="button"
                    disabled={
                      pactRequired ||
                      atWar ||
                      RESOURCE_IDS.some((id) => resources[id] < (SETTLEMENT_FOUNDING_COST[id] ?? 0))
                    }
                    onClick={() => send('found', { regionId: region.regionId })}
                  >
                    {atWar
                      ? 'Em guerra: fundação bloqueada'
                      : hostile && pactRequired
                        ? 'Relação hostil: melhore a relação e firme um pacto'
                        : pactRequired
                          ? 'Pacto de não agressão necessário'
                          : 'Fundar cidade · 220 materiais, 30 alimentos, 60 água e 10 energia'}
                  </button>
                )}
              </article>
            </li>
          );
        })}
      </ul>

      <h3>Assentamentos</h3>
      <ul className="empire-city-list">
        {cities.map((city) => (
          <li key={city.settlementId}>
            <button
              type="button"
              aria-pressed={selectedId === city.settlementId}
              onClick={() => setSelectedId(city.settlementId)}
            >
              {city.capital ? '★ ' : ''}
              {city.name} · {city.population.survivors} habitantes
            </button>
          </li>
        ))}
      </ul>

      <article className="empire-city-detail">
        <h3>
          {selected.name}
          {selected.capital ? ' · Capital' : ''}
        </h3>
        <p>{REGION_DEFINITIONS[selected.regionId].environment}</p>
        {Object.entries(REGION_DEFINITIONS[selected.regionId].opportunities).length > 0 && (
          <p>
            Recursos regionais por tick:{' '}
            {Object.entries(REGION_DEFINITIONS[selected.regionId].opportunities)
              .map(([id, amount]) => `${RESOURCE_DEFINITIONS[id as ResourceId].name} +${amount}`)
              .join(' · ')}
          </p>
        )}
        <p>
          População: {selected.population.survivors} · Capacidade:{' '}
          {selected.buildings.reduce(
            (n, b) => n + (getBuildingDefinition(b.definitionId).housingCapacity ?? 0),
            0,
          )}
        </p>
        <ul className="empire-resource-list">
          {RESOURCE_IDS.map((id) => (
            <li key={id}>
              {RESOURCE_DEFINITIONS[id].name}: {format.format(selected.resources[id])}
            </li>
          ))}
        </ul>
        <h4>Edifícios locais ({selected.buildings.length})</h4>
        <ul>
          {selected.buildings.map((building) => (
            <li key={building.instanceId}>{BUILDING_DEFINITIONS[building.definitionId].name}</li>
          ))}
        </ul>

        {!selected.capital && (
          <>
            <h4>Administração</h4>
            <label>
              Governador
              <select
                aria-label={`Governador de ${selected.name}`}
                value={selected.administratorId ?? ''}
                onChange={(event) =>
                  send('appoint', {
                    settlementId: selected.settlementId,
                    characterId: event.target.value || null,
                  })
                }
              >
                <option value="">Sem governador</option>
                {administrators.map((person) => (
                  <option key={person.characterId} value={person.characterId}>
                    {person.name} · liderança {person.skills.leadership}/5
                  </option>
                ))}
              </select>
            </label>
            {selected.administratorId && (
              <small>Governador com liderança 2+ gera 1 material a cada 10 ticks.</small>
            )}
            <h4>Transferir do capital</h4>
            <label>
              Recurso
              <select
                aria-label="Recurso a transferir"
                value={resourceId}
                onChange={(event) => setResourceId(event.target.value as ResourceId)}
              >
                {RESOURCE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {RESOURCE_DEFINITIONS[id].name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantidade{' '}
              <input
                aria-label="Quantidade de recurso"
                type="number"
                min={1}
                step={1}
                value={transferAmount}
                onChange={(event) => setTransferAmount(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                send('transfer-resources', {
                  settlementId: selected.settlementId,
                  resources: { [resourceId]: transferAmount },
                })
              }
            >
              Enviar recurso
            </button>
            <label>
              Colonizadores{' '}
              <input
                aria-label="Quantidade de colonizadores"
                type="number"
                min={1}
                max={8}
                step={1}
                value={peopleAmount}
                onChange={(event) => setPeopleAmount(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              disabled={
                selected.population.survivors + peopleAmount >
                selected.buildings.reduce(
                  (n, b) => n + (getBuildingDefinition(b.definitionId).housingCapacity ?? 0),
                  0,
                )
              }
              onClick={() =>
                send('transfer-population', {
                  settlementId: selected.settlementId,
                  amount: peopleAmount,
                })
              }
            >
              Transferir habitantes do capital
            </button>
            <h4>Construir localmente</h4>
            <ul className="empire-build-list">
              {Object.values(BUILDING_DEFINITIONS)
                .filter(
                  (definition: BuildingDefinition) =>
                    definition.category !== 'military' &&
                    (!definition.requiredTechnologyId ||
                      research.unlockedTechnologyIds.includes(definition.requiredTechnologyId)),
                )
                .map((definition: BuildingDefinition) => {
                  const cost = selectBuildingCost(definition.cost, research.unlockedTechnologyIds);
                  const affordable = RESOURCE_IDS.every(
                    (id) => selected.resources[id] >= (cost[id] ?? 0),
                  );
                  return (
                    <li key={definition.id}>
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() =>
                          send('build', {
                            settlementId: selected.settlementId,
                            buildingId: definition.id,
                          })
                        }
                      >
                        Construir {definition.name}
                      </button>
                    </li>
                  );
                })}
            </ul>
            <small>Novos edifícios usam o primeiro espaço livre do grid local de 16 × 16.</small>
          </>
        )}
      </article>
      <p role="status" aria-live="polite">
        {feedback}
      </p>
    </section>
  );
}
