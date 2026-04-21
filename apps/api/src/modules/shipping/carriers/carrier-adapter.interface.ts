/**
 * Generic carrier-adapter interface. Every carrier (DHL, UPS, DPD ...)
 * implements these operations. New carriers can be plugged in without
 * changing the ShipmentService.
 */

export interface ShipmentCreateInput {
  orgId: string;
  orderId: string;
  recipient: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address: {
      street: string;
      houseNumber?: string;
      address2?: string | null;
      zip: string;
      city: string;
      province?: string | null;
      country: string; // ISO-2
    };
  };
  sender: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address: {
      street: string;
      houseNumber?: string;
      address2?: string | null;
      zip: string;
      city: string;
      country: string;
    };
  };
  shippingMethod?: string;
  weightG: number;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  reference?: string;
}

export interface CarrierShipmentResult {
  trackingNumber: string;
  trackingUrl?: string | null;
  labelFormat: 'pdf_a4' | 'pdf_100x150' | 'pdf_103x199' | 'zpl_100x150' | 'zpl_103x199';
  labelContent?: string; // ZPL raw string
  labelPdfBase64?: string;
  labelHtml?: string; // Browser-printable fallback
  costCents?: number | null;
  currency?: string | null;
}

export interface CarrierTrackingResult {
  status: 'label_created' | 'handed_to_carrier' | 'in_transit' | 'out_for_delivery'
       | 'delivered' | 'delivery_failed' | 'ready_for_pickup' | 'returned' | 'exception';
  events: Array<{
    status: CarrierTrackingResult['status'];
    occurredAt: Date;
    note?: string | null;
    rawData?: any;
  }>;
}

export interface CarrierAdapter {
  /** Unique key per carrier, matches ShippingCarrier enum */
  readonly key: string;
  readonly humanName: string;
  /** Whether this adapter requires credentials to work */
  readonly requiresCredentials: boolean;

  /** Create a shipment + generate label. May return stub data if no API access yet. */
  createShipment(input: ShipmentCreateInput, credentials: any | null): Promise<CarrierShipmentResult>;

  /** Query shipment status by tracking number. */
  getTracking?(trackingNumber: string, credentials: any | null): Promise<CarrierTrackingResult | null>;

  /** Validate credentials structure. */
  validateCredentials?(credentials: any): { ok: boolean; error?: string };
}
