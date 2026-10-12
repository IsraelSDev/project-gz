import type { ResourceId } from '@/game/content/resources';

/*
 * Ícones provisórios dos recursos (o conteúdo ainda não define ícones nem cores): formas
 * geométricas simples, originais e em SVG embutido, sem dependências nem arquivos externos. O
 * `Record` exige um ícone para cada `ResourceId` do conteúdo. Decorativos: o nome do recurso está
 * sempre no texto ao lado.
 */
interface IconSpec {
  readonly shape: string;
  /** Traços internos opcionais, desenhados por cima da forma. */
  readonly detail?: string;
  readonly color: string;
}

const ICONS: Readonly<Record<ResourceId, IconSpec>> = {
  food: {
    shape: 'M12 7.5c-4.4 0-7 3-7 6.7 0 3.4 2.4 6.3 7 6.3s7-2.9 7-6.3c0-3.7-2.6-6.7-7-6.7z',
    detail: 'M12 7.5C12 4.6 13.4 3 16 3c0 2.9-1.4 4.5-4 4.5z',
    color: '#9be37a',
  },
  water: {
    shape: 'M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z',
    color: '#6fd8ff',
  },
  materials: {
    shape: 'M12 2.5 20.5 7v10L12 21.5 3.5 17V7z',
    detail: 'M3.5 7 12 12l8.5-5M12 12v9.5',
    color: '#ffb76b',
  },
  energy: {
    shape: 'M13.5 2 5 13.5h6L10 22l9-12h-6.2z',
    color: '#ffe066',
  },
};

export function ResourceIcon({ id }: { readonly id: ResourceId }) {
  const icon = ICONS[id];
  return (
    <svg
      className="resource__icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.shape} fill={icon.color} />
      {icon.detail && (
        <path
          d={icon.detail}
          fill="none"
          stroke="rgba(20, 18, 48, 0.55)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
