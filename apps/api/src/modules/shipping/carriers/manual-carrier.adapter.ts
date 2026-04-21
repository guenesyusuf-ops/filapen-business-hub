import { Injectable } from '@nestjs/common';
import type { CarrierAdapter, CarrierShipmentResult, ShipmentCreateInput } from './carrier-adapter.interface';
import { buildLabelHtml } from './label-html-builder';
import * as crypto from 'crypto';

/**
 * Manual/custom-carrier fallback. Used when no API exists for a carrier.
 * User will type the real tracking number later.
 */
@Injectable()
export class ManualCarrierAdapter implements CarrierAdapter {
  readonly key = 'custom';
  readonly humanName = 'Manuell / Sonstige';
  readonly requiresCredentials = false;

  async createShipment(input: ShipmentCreateInput): Promise<CarrierShipmentResult> {
    const trackingNumber = 'MANUAL-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const html = buildLabelHtml(input, {
      carrier: 'MANUELL',
      trackingNumber,
      format: 'pdf_100x150',
      note: 'Tracking-Nummer später bei Carrier eintragen.',
    });
    return {
      trackingNumber,
      trackingUrl: null,
      labelFormat: 'pdf_100x150',
      labelHtml: html,
    };
  }
}
