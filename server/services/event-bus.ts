import { EventEmitter } from 'events';

export interface SystemEvent {
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
}

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public emit(eventName: string | symbol, ...args: any[]): boolean {
    return super.emit(eventName, ...args);
  }

  public emitSystemEvent(event: SystemEvent): boolean {
    return this.emit(event.type, event);
  }

  public on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(eventName, listener);
  }

  public once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(eventName, listener);
  }

  public off(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(eventName, listener);
  }
}

export default EventBus.getInstance();
