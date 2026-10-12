import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/*
 * Regras de dependência entre camadas: docs/TECHNICAL_ARCHITECTURE.md §3.6.
 * Cada camada abaixo lista o que NÃO pode importar. As pastas ainda não existem na Fase 1;
 * as regras passam a valer conforme os arquivos forem criados.
 */

// Camadas: caminho com alias ("@/…") e nome da pasta (para importações relativas).
const LAYERS = {
  shared: { alias: 'shared', dir: 'shared' },
  content: { alias: 'game/content', dir: 'content' },
  domain: { alias: 'game/domain', dir: 'domain' },
  application: { alias: 'game/application', dir: 'application' },
  session: { alias: 'session', dir: 'session' },
  rendering: { alias: 'rendering', dir: 'rendering' },
  presentation: { alias: 'presentation', dir: 'presentation' },
  platform: { alias: 'platform', dir: 'platform' },
  app: { alias: 'app', dir: 'app' },
};

const REACT_PACKAGES = ['react', 'react-dom'];
const BABYLON_GROUP = ['@babylonjs/**'];

/** Padrões de importação de uma camada (alias e relativo). */
const layerGroup = (name) => {
  const { alias, dir } = LAYERS[name];
  return [`@/${alias}`, `@/${alias}/**`, `**/${dir}`, `**/${dir}/**`];
};

/**
 * Monta a regra de importações proibidas.
 * @param {object} opts
 * @param {string[]} opts.banned camadas proibidas (importação em tempo de execução e de tipos)
 * @param {string[]} [opts.runtimeOnly] camadas em que somente `import type` é permitido
 * @param {boolean} [opts.react] proíbe react e react-dom
 * @param {boolean} [opts.babylon] proíbe @babylonjs/*
 */
const restrict = ({ banned, runtimeOnly = [], react = false, babylon = false }) => {
  const patterns = [
    ...banned.map((name) => ({
      group: layerGroup(name),
      message: `A camada "${name}" não pode ser importada aqui (TECHNICAL_ARCHITECTURE.md §3.6).`,
    })),
    ...runtimeOnly.map((name) => ({
      group: layerGroup(name),
      allowTypeImports: true,
      message: `Aqui só é permitido "import type" da camada "${name}" (TECHNICAL_ARCHITECTURE.md §3.6).`,
    })),
  ];
  if (react) {
    patterns.push({
      group: REACT_PACKAGES.flatMap((pkg) => [pkg, `${pkg}/**`]),
      message: 'React não pode ser usado nesta camada (TECHNICAL_ARCHITECTURE.md §3.6).',
    });
  }
  if (babylon) {
    patterns.push({
      group: BABYLON_GROUP,
      message: 'Babylon.js não pode ser usado nesta camada (TECHNICAL_ARCHITECTURE.md §3.6).',
    });
  }
  return { '@typescript-eslint/no-restricted-imports': ['error', { patterns }] };
};

const everyLayer = Object.keys(LAYERS);
const except = (...keep) => everyLayer.filter((name) => !keep.includes(name));

// APIs de navegador e de armazenamento que a lógica de jogo não deve usar diretamente.
const BROWSER_GLOBALS = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator',
  'requestAnimationFrame',
  'cancelAnimationFrame',
].map((name) => ({
  name,
  message: 'API de navegador fora do alcance da lógica de jogo (Arquitetura §3.1/§3.4).',
}));

const NON_DETERMINISTIC_MESSAGE =
  'Fonte de não determinismo proibida no domínio (TECHNICAL_ARCHITECTURE.md §6.3).';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', 'docs']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // --- Dependências entre camadas -------------------------------------------------------------
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: restrict({ banned: except('shared'), react: true, babylon: true }),
  },
  {
    files: ['src/game/content/**/*.{ts,tsx}'],
    rules: restrict({ banned: except('shared', 'content'), react: true, babylon: true }),
  },
  {
    files: ['src/game/domain/**/*.{ts,tsx}'],
    rules: restrict({
      banned: except('shared', 'content', 'domain'),
      react: true,
      babylon: true,
    }),
  },
  {
    files: ['src/game/application/**/*.{ts,tsx}'],
    rules: restrict({
      banned: except('shared', 'content', 'domain', 'application'),
      react: true,
      babylon: true,
    }),
  },
  {
    files: ['src/session/**/*.{ts,tsx}'],
    rules: restrict({
      banned: except('shared', 'session', 'content', 'domain'),
      runtimeOnly: ['content', 'domain'],
      react: true,
      babylon: true,
    }),
  },
  {
    files: ['src/rendering/**/*.{ts,tsx}'],
    rules: restrict({
      banned: ['application', 'presentation', 'platform', 'app'],
      runtimeOnly: ['content', 'domain'],
      react: true,
    }),
  },
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: restrict({
      banned: ['rendering', 'platform', 'app'],
      runtimeOnly: ['content', 'domain'],
      babylon: true,
    }),
  },
  {
    files: ['src/platform/**/*.{ts,tsx}'],
    rules: restrict({
      banned: ['content', 'domain', 'session', 'rendering', 'presentation', 'app'],
      runtimeOnly: ['application'],
      react: true,
      babylon: true,
    }),
  },

  // --- Lógica de jogo: sem APIs de navegador; domínio: sem fontes de não determinismo ---------
  {
    files: ['src/game/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
    rules: { 'no-restricted-globals': ['error', ...BROWSER_GLOBALS] },
  },
  {
    files: ['src/game/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS,
        { name: 'performance', message: NON_DETERMINISTIC_MESSAGE },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: NON_DETERMINISTIC_MESSAGE },
        { object: 'Date', property: 'now', message: NON_DETERMINISTIC_MESSAGE },
        { object: 'performance', property: 'now', message: NON_DETERMINISTIC_MESSAGE },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: NON_DETERMINISTIC_MESSAGE,
        },
      ],
    },
  },

  // Deve vir por último: desativa regras de estilo que conflitam com o Prettier.
  prettier,
]);
