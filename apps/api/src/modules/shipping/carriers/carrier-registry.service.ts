import { Injectable } from '@nestjs/common';
import type { CarrierAdapter } from './carrier-adapter.interface';
import { DhlCarrierAdapter } from './dhl-carrier.adapter';
import { ManualCarrierAdapter } from './manual-carrier.adapter';

/**
 * Central registry — new carriers are just added here without touching
 * the rest of the shipping logic.
 */
@Injectable()
export class CarrierRegistry {
  private readonly adapters: Map<string, CarrierAdapter> = new Map();

  constructor(
    private readonly dhl: DhlCarrierAdapter,
    private readonly manual: ManualCarrierAdapter,
  ) {
    this.register(dhl);
    this.register(manual);
  }

  register(adapter: CarrierAdapter): void {
    this.adapters.set(adapter.key, adapter);
  }

  get(carrier: string): CarrierAdapter {
    const a = this.adapters.get(carrier);
    if (!a) {
      // Fall back to manual for unknown carriers
      return this.manual;
    }
    return a;
  }

  list(): Array<{ key: string; humanName: string; requiresCredentials: boolean; implemented: boolean }> {
    return Array.from(this.adapters.values()).map((a) => ({
      key: a.key,
      humanName: a.humanName,
      requiresCredentials: a.requiresCredentials,
      implemented: true,
    }));
  }
}
