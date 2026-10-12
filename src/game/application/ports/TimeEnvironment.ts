/**
 * Porta do ambiente de tempo real e de visibilidade. A camada de aplicação NÃO lê relógio nem
 * `document`: tudo entra por aqui, implementado em `platform/time/` no navegador e substituído por
 * um dublê nos testes (sem DOM, sem esperas reais). O domínio nem chega a ver esta porta.
 */
export interface TimeEnvironment {
  /** Tempo real monotônico, em milissegundos (`performance.now()` no navegador). */
  now(): number;
  /** Agenda `callback` para o próximo quadro de animação e devolve um identificador. */
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
  /** Verdadeiro quando a aba/página está oculta (em segundo plano). */
  isHidden(): boolean;
  /** Avisa quando a visibilidade muda; devolve a função que cancela a assinatura. */
  onVisibilityChange(listener: () => void): () => void;
}
