type EventHandler = (...args: unknown[]) => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.forEach(handler => handler(...args));
  }
}

export const eventBus = new EventBus();

export const Events = {
  ROUTE_SELECTED: 'route:selected',
  NAV_STARTED: 'nav:started',
  NAV_STOPPED: 'nav:stopped',
  NAV_PROGRESS: 'nav:progress',
  NAV_STEP_CHANGED: 'nav:step_changed',
  NAV_ARRIVED: 'nav:arrived',
  RECALCULATE_REQUESTED: 'nav:recalculate',
  RECALCULATE_DONE: 'nav:recalculate_done',
  OFF_ROUTE: 'nav:off_route',
  TRANSIT_ALERT: 'transit:alert',
  TRANSIT_STATE_CHANGED: 'transit:state_changed',
  DISPLAY_MODE_CHANGED: 'display:mode_changed',
  ERROR: 'error',
} as const;
