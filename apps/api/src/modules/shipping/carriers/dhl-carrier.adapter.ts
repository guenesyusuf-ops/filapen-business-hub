import { Injectable, Logger } from '@nestjs/common';
import type { CarrierAdapter, CarrierShipmentResult, CarrierTrackingResult, ShipmentCreateInput } from './carrier-adapter.interface';
import { buildLabelHtml } from './label-html-builder';
import * as crypto from 'crypto';

/**
 * DHL Carrier Adapter.
 *
 * Current state: STUB MODE — falls back to HTML-Label generation without
 * real DHL API contact. Once the user has DHL Business Customer Portal
 * API credentials (EKP-Nr, App-ID, App-Token, User, Password), set
 * credentials.apiReady=true on the CarrierAccount and the real
 * calls below are activated.
 *
 * DHL API endpoint (for future wire-up):
 *   POST https://api-eu.dhl.com/parcel/de/shipping/v2/orders
 * Required fields: billingNumber, shipper, consignee, details (weight, dim).
 * See https://developer.dhl.com/api-reference/parcel-germany-post-parcel-api
 */
@Injectable()
export class DhlCarrierAdapter implements CarrierAdapter {
  private readonly logger = new Logger(DhlCarrierAdapter.name);
  readonly key = 'dhl';
  readonly humanName = 'DHL';
  readonly requiresCredentials = true;

  validateCredentials(credentials: any): { ok: boolean; error?: string } {
    if (!credentials) return { ok: false, error: 'Keine Credentials hinterlegt' };
    // DHL Business API needs: billingNumber (EKP), username, password
    if (!credentials.billingNumber) return { ok: false, error: 'EKP-Nr (billingNumber) fehlt' };
    if (!credentials.username || !credentials.password) {
      return { ok: false, error: 'Username/Password fehlt' };
    }
    return { ok: true };
  }

  async createShipment(input: ShipmentCreateInput, credentials: any | null): Promise<CarrierShipmentResult> {
    // If credentials are missing or flagged as not-ready → STUB mode.
    // This lets the user test the whole flow (generate labels, print, track
    // manually) before the DHL API contract is live.
    const apiReady = credentials && this.validateCredentials(credentials).ok;

    if (!apiReady) {
      this.logger.warn(`DHL in STUB mode — no API credentials. Generating local HTML label.`);
      const trackingNumber = this.generateStubTrackingNumber();
      const html = buildLabelHtml(input, {
        carrier: 'DHL',
        trackingNumber,
        format: 'pdf_100x150',
        note: 'Stub-Label (ohne DHL-API). Tracking manuell bei DHL anlegen.',
      });
      return {
        trackingNumber,
        trackingUrl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${trackingNumber}`,
        labelFormat: 'pdf_100x150',
        labelHtml: html,
        costCents: null,
        currency: null,
      };
    }

    // TODO: Once DHL API credentials are provided, implement real call:
    //
    // const response = await fetch('https://api-eu.dhl.com/parcel/de/shipping/v2/orders', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64'),
    //     'dhl-api-key': credentials.apiKey,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     profile: 'STANDARD_GRUPPENPROFIL',
    //     shipments: [{
    //       product: input.shippingMethod || 'V01PAK',
    //       billingNumber: credentials.billingNumber,
    //       refNo: input.reference || input.orderId,
    //       shipper: { name1: input.sender.name, addressStreet: input.sender.address.street, postalCode: input.sender.address.zip, city: input.sender.address.city, country: input.sender.address.country },
    //       consignee: { name1: input.recipient.name, addressStreet: input.recipient.address.street, postalCode: input.recipient.address.zip, city: input.recipient.address.city, country: input.recipient.address.country, email: input.recipient.email, phone: input.recipient.phone },
    //       details: { weight: { uom: 'kg', value: input.weightG / 1000 }, dim: input.lengthMm && input.widthMm && input.heightMm ? { uom: 'mm', length: input.lengthMm, width: input.widthMm, height: input.heightMm } : undefined },
    //     }],
    //   }),
    // });
    // const data = await response.json();
    // return {
    //   trackingNumber: data.items[0].shipmentNo,
    //   trackingUrl: data.items[0].url,
    //   labelFormat: 'pdf_100x150',
    //   labelPdfBase64: data.items[0].label.b64,
    //   costCents: Math.round((data.items[0].cost || 0) * 100),
    //   currency: 'EUR',
    // };

    throw new Error('DHL API integration TODO — credentials provided but live API not yet implemented');
  }

  async getTracking(trackingNumber: string, credentials: any | null): Promise<CarrierTrackingResult | null> {
    if (!credentials || !this.validateCredentials(credentials).ok) {
      return null; // Stub mode — tracking updates must be entered manually
    }
    // TODO: Real tracking via DHL API
    //   GET https://api-eu.dhl.com/parcel/de/tracking/v0/shipments/{trackingNumber}
    this.logger.debug(`DHL tracking API TODO for ${trackingNumber}`);
    return null;
  }

  private generateStubTrackingNumber(): string {
    // DHL format looks like: 00340434161094017299
    const base = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `STUB${Date.now().toString().slice(-8)}${base.slice(0, 6)}`;
  }
}
