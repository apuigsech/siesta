export type PulseState = {
  status: unknown;
  error: string | null;
  refreshing: boolean;
  refreshId: string | null;
  root: string | null;
  roadmap: string | null;
  more: boolean;
  item: string | null;
  language: string | null;
  // Whether each worker's session is running a turn now, by session id; empty where the host cannot say.
  running: Record<string, boolean>;
  // Flips while a worker runs, so its card's border beats.
  pulse: boolean;
};

declare module 'claude-code' {
  interface PluginState {
    siesta: { pulse: Shaped<PulseState> };
  }
}
